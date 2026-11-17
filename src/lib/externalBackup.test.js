import { test, expect } from 'bun:test';
import { collectBackup, expiredBackupNames, backupIsStale, PREFIX } from '../../supabase/functions/external-backup/backup';
import { selectBackupTables, countMismatches, EXCLUDED_TABLES } from '../../supabase/functions/_shared/backup-tables';

const PUBLIC_TABLES = ['account_locks','account_unlock_letters','approval_audit_logs','asset_assignments','assets','attendance','attendance_audit_logs','attendance_notifications','attendance_violations','backup_audit_logs','biometric_consent_records','business_travel_requests','company_announcements','company_events','contract_history','contract_reminders_log','disciplinary_actions','employee_coaching','employee_documents','employee_loans','employee_trainings','exit_interviews','final_settlements','geocoding_cache','handover_checklists','kpi_grade_settings','kpi_indicators','kpi_monthly_attachments','kpi_realizations','late_reasons','leave_requests','loan_installments','notification_last_seen','overtime_requests','payroll','payroll_audit_logs','payroll_overrides','payroll_periods','pph21_ter_rates','profiles','salary_change_history','special_leave_types','system_settings','training_programs','user_roles'];

test('shared table list covers every public table except the excluded cache', () => {
  const { tables, skipped } = selectBackupTables(PUBLIC_TABLES.map(t => ({ table_name: t, pk_columns: ['id'] })));
  const names = tables.map(t => t.table_name);
  expect(names.length).toBe(44);
  expect(names).toEqual(PUBLIC_TABLES.filter(t => !(t in EXCLUDED_TABLES)));
  for (const t of ['user_roles', 'system_settings', 'attendance_violations', 'disciplinary_actions', 'account_unlock_letters']) expect(names).toContain(t);
  expect(skipped).toEqual([{ table: 'geocoding_cache', reason: EXCLUDED_TABLES.geocoding_cache }]);
});
test('exports across the 1000-row page boundary with a manifest of row counts', async () => {
  const backup = await collectBackup(['attendance', 'user_roles'], [], async (table, from) => table === 'attendance' ? (from === 0 ? Array.from({ length: 1000 }, (_, id) => ({ id })) : [{ id: 1000 }]) : [{ id: 1 }]);
  expect(backup.manifest.row_counts).toEqual({ attendance: 1001, user_roles: 1 });
  expect(backup.manifest.total_records).toBe(1002);
});
test('never produces a successful partial backup on export failure', async () => {
  await expect(collectBackup(['profiles', 'payroll'], [], async table => { if (table === 'payroll') throw new Error('unavailable'); return []; })).rejects.toThrow('unavailable');
});
test('any row-count difference between file and source fails verification', () => {
  expect(countMismatches({ a: 2, b: 3 }, { a: 2, b: 3 })).toEqual([]);
  expect(countMismatches({ a: 2 }, { a: 3 }).length).toBe(1);
  expect(countMismatches({ a: 2 }, { a: 2, b: 0 }).length).toBe(1);
});
test('alerts only when no backup succeeded in 36 hours', () => {
  const now = new Date('2026-11-17T12:00:00Z');
  expect(backupIsStale(['2026-11-16T01:00:00Z', null], now)).toBe(false);
  expect(backupIsStale(['2026-11-15T23:59:00Z', undefined], now)).toBe(true);
  expect(backupIsStale([null, null], now)).toBe(true);
});
test('retention keeps 14 latest owned backups without deleting unrelated files', () => {
  const files = Array.from({ length: 16 }, (_, i) => ({ name: `backup-2026-11-${String(i + 1).padStart(2, '0')}T00-00-00-000Z.json` }));
  files.push({ name: 'unrelated.json' }, { name: 'scheduled-backup-2020.json' });
  expect(expiredBackupNames(files)).toEqual([`${PREFIX}/backup-2026-11-02T00-00-00-000Z.json`, `${PREFIX}/backup-2026-11-01T00-00-00-000Z.json`]);
});
