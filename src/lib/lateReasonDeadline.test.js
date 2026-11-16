import { test, expect } from 'bun:test';
import { isWithinLateReasonDeadline } from './lateReasonDeadline';
import { isolated } from './missing-late-reason.test';

test('history permits 23 hours, hides action at 25 hours, respects configured duration', () => {
  const start = '2026-11-15T03:00:00Z';
  expect(isWithinLateReasonDeadline(start,24,Date.parse(start)+23*3600000)).toBe(true);
  expect(isWithinLateReasonDeadline(start,24,Date.parse(start)+25*3600000)).toBe(false);
  expect(isWithinLateReasonDeadline(start,48,Date.parse(start)+25*3600000)).toBe(true);
});
test('server accepts a reason at 23 hours and protects the violation', async () => isolated(async tx => {
  await tx`UPDATE attendance SET check_in_time='2026-11-15 11:00+07'`;
  await tx`INSERT INTO attendance_violations SELECT gen_random_uuid(),user_id,id,NULL,'2026-11-15','late_no_reason_submitted',true FROM attendance`;
  await tx`SELECT pg_temp.submit_late_reason(id,'Ban bocor') FROM attendance`;
  expect(await tx`SELECT * FROM late_reasons`).toHaveLength(1);
  expect(await tx`SELECT * FROM attendance_violations WHERE is_counted`).toHaveLength(0);
}));
test('server rejects 25 hours even before the scanner creates a violation', async () => isolated(async tx => {
  await tx`UPDATE attendance SET check_in_time='2026-11-15 09:00+07'`;
  let error;
  try { await tx.savepoint(async q => { await q`SELECT pg_temp.submit_late_reason(id,'Ban bocor') FROM attendance`; }); } catch(e) { error=e; }
  expect(error?.message).toContain('Batas waktu pengajuan alasan keterlambatan sudah lewat');
  expect(await tx`SELECT * FROM late_reasons`).toHaveLength(0);
}));
test('submission and scanner share a non-default 48-hour setting', async () => isolated(async tx => {
  await tx`CREATE OR REPLACE FUNCTION pg_temp.late_reason_deadline_hours() RETURNS integer LANGUAGE sql AS $$SELECT 48$$`;
  await tx`UPDATE attendance SET check_in_time='2026-11-15 09:00+07'`;
  expect((await tx`SELECT pg_temp.scan_missing_late_reasons() n`)[0].n).toBe(0);
  await tx`SELECT pg_temp.submit_late_reason(id,'Ban bocor') FROM attendance`;
  expect(await tx`SELECT * FROM late_reasons`).toHaveLength(1);
}));
test('late direct database submission does not cancel violations, SP or lock', async () => isolated(async tx => {
  await tx`UPDATE attendance SET check_in_time='2026-11-15 09:00+07'`;
  await tx`SELECT pg_temp.scan_missing_late_reasons()`;
  await tx`INSERT INTO disciplinary_actions(user_id,period_month,warning_type) SELECT user_id,'2026-11-01','sp1' FROM attendance`;
  await tx`INSERT INTO account_locks SELECT gen_random_uuid(),user_id,'locked','2026-11-15 18:00+07','Akun dikunci otomatis karena mencapai 11 pelanggaran',NULL,NULL FROM attendance`;
  await tx`INSERT INTO late_reasons(attendance_id,user_id,reason,submitted_at) SELECT id,user_id,'Late direct write','2026-11-16 10:00+07' FROM attendance`;
  await tx`UPDATE attendance_violations SET is_counted=true`;
  expect(await tx`SELECT * FROM attendance_violations WHERE is_counted`).toHaveLength(1);
  expect(await tx`SELECT * FROM disciplinary_actions WHERE status='active'`).toHaveLength(1);
  expect(await tx`SELECT * FROM account_locks WHERE status='locked'`).toHaveLength(1);
}));
test('HR waiver records required note and supersedes SP below threshold', async () => isolated(async tx => {
  await tx`INSERT INTO attendance_violations SELECT gen_random_uuid(),user_id,id,NULL,'2026-11-15','late_no_reason_submitted',true FROM attendance CROSS JOIN generate_series(1,5)`;
  await tx`INSERT INTO disciplinary_actions(user_id,period_month,warning_type) SELECT user_id,'2026-11-01','sp1' FROM attendance`;
  await tx`SELECT pg_temp.waive_attendance_violation(id,'Koreksi HR: bukti perjalanan') FROM attendance_violations LIMIT 1`;
  expect(await tx`SELECT * FROM attendance_violations WHERE is_counted`).toHaveLength(4);
  expect(await tx`SELECT * FROM attendance_audit_logs WHERE reason='Koreksi HR: bukti perjalanan'`).toHaveLength(1);
  expect(await tx`SELECT * FROM disciplinary_actions WHERE status='superseded'`).toHaveLength(1);
}));
for (const kind of ['empty note','employee']) test(`waiver rejects ${kind}`, async () => isolated(async tx => {
  await tx`INSERT INTO attendance_violations SELECT gen_random_uuid(),user_id,id,NULL,'2026-11-15','late_no_reason_submitted',true FROM attendance`;
  if(kind==='employee') await tx`CREATE OR REPLACE FUNCTION pg_temp.is_discipline_admin() RETURNS boolean LANGUAGE sql AS $$SELECT false$$`;
  let error;
  try { await tx.savepoint(async q => { await q`SELECT pg_temp.waive_attendance_violation(id,${kind==='empty note'?' ':'Koreksi'}) FROM attendance_violations`; }); } catch(e) {error=e;}
  expect(error?.message).toContain(kind==='empty note'?'Catatan wajib':'Only admin/HR');
  expect(await tx`SELECT * FROM attendance_violations WHERE is_counted`).toHaveLength(1);
}));
for(const [type,count] of [['sp1',5],['sp2',8]]) test(`${type} reactivates at ${count}, notifies HR and employee once, reuses unique row`, async () => isolated(async tx => {
  await tx`CREATE OR REPLACE FUNCTION pg_temp.get_rolling_3month_violation_count(uuid,date) RETURNS integer LANGUAGE sql AS $$SELECT 0$$`;
  // Replace only the rolling counter with a disposable stub in this isolated function.
  const [fn]=await tx`SELECT pg_get_functiondef(oid) d FROM pg_proc WHERE pronamespace=pg_my_temp_schema() AND proname='check_attendance_thresholds'`;
  await tx.unsafe(fn.d.replace(/public.get_rolling_3month_violation_count/g,'pg_temp.get_rolling_3month_violation_count'));
  await tx`INSERT INTO user_roles VALUES('00000000-0000-0000-0000-000000000003','hr')`;
  await tx`INSERT INTO attendance_violations SELECT gen_random_uuid(),user_id,id,NULL,'2026-11-15','absent_without_permission',true FROM attendance CROSS JOIN generate_series(1,${count})`;
  await tx`INSERT INTO disciplinary_actions(user_id,period_month,warning_type,status,issue_date,document_url) SELECT user_id,'2026-11-01',${type},'superseded','2026-11-01','old.pdf' FROM attendance`;
  const [before]=await tx`SELECT id FROM disciplinary_actions`;
  await tx`SELECT pg_temp.check_attendance_thresholds(user_id,'2026-11-15') FROM attendance`;
  await tx`SELECT pg_temp.check_attendance_thresholds(user_id,'2026-11-15') FROM attendance`;
  const warnings=await tx`SELECT * FROM disciplinary_actions`;
  expect(warnings).toHaveLength(1); expect(warnings[0].id).toBe(before.id);
  expect(warnings[0].status).toBe('active'); expect(warnings[0].violation_count_at_issuance).toBe(count);
  expect(warnings[0].document_url).toBeNull(); expect(warnings[0].issue_date.getTime()).toBeGreaterThan(Date.parse('2026-11-01'));
  expect(await tx`SELECT * FROM attendance_notifications WHERE notif_type=${type+'_issued'}`).toHaveLength(2);
  expect(await tx`SELECT * FROM attendance_audit_logs WHERE action_type='discipline_reconciled'`).toHaveLength(1);
}));
