import { test, expect } from 'bun:test';
import { collectBackup, expiredBackupNames, TABLES, PREFIX } from '../../supabase/functions/external-backup/backup';

test('exports all existing backup tables across the 1000-row page boundary', async () => {
  const backup = await collectBackup(async (table, from) => table === 'attendance' ? (from === 0 ? Array.from({ length: 1000 }, (_, id) => ({ id })) : [{ id: 1000 }]) : [{ id: table }]);
  expect(backup.tables).toEqual(TABLES);
  expect(backup.data.attendance.length).toBe(1001);
  expect(Object.keys(backup.data).length).toBe(10);
});
test('never produces a successful partial backup on export failure', async () => {
  await expect(collectBackup(async table => { if (table === 'payroll') throw new Error('unavailable'); return []; })).rejects.toThrow('unavailable');
});
test('retention keeps 14 latest owned backups without deleting unrelated files', () => {
  const files = Array.from({ length: 16 }, (_, i) => ({ name: `backup-2026-11-${String(i + 1).padStart(2, '0')}T00-00-00-000Z.json` }));
  files.push({ name: 'unrelated.json' }, { name: 'scheduled-backup-2020.json' });
  expect(expiredBackupNames(files)).toEqual([`${PREFIX}/backup-2026-11-02T00-00-00-000Z.json`, `${PREFIX}/backup-2026-11-01T00-00-00-000Z.json`]);
});