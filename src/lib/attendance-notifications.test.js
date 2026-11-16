import { test, expect } from 'bun:test';
import postgres from 'postgres';

// Installed functions run only against transaction-local tables and a fixed clock.
async function isolated(check) {
  if (!process.env.SUPABASE_DB_URL) throw new Error('Database connection required');
  const sql = postgres(process.env.SUPABASE_DB_URL,{max:1,prepare:false});
  try { await sql.begin(async tx => {
    await tx.unsafe(`
      CREATE TEMP TABLE profiles(id uuid,status text,departemen text,account_status text) ON COMMIT DROP;
      CREATE TEMP TABLE attendance(id uuid,user_id uuid,status text,late_minutes integer,check_in_time timestamptz) ON COMMIT DROP;
      CREATE TEMP TABLE late_reasons(LIKE public.late_reasons INCLUDING DEFAULTS) ON COMMIT DROP;
      CREATE TEMP TABLE attendance_violations(LIKE public.attendance_violations INCLUDING DEFAULTS) ON COMMIT DROP;
      CREATE TEMP TABLE attendance_notifications(LIKE public.attendance_notifications INCLUDING DEFAULTS) ON COMMIT DROP;
      CREATE UNIQUE INDEX notices_event ON attendance_notifications(user_id,event_key) WHERE event_key IS NOT NULL;
      CREATE TEMP TABLE attendance_audit_logs(LIKE public.attendance_audit_logs INCLUDING DEFAULTS) ON COMMIT DROP;
      CREATE TEMP TABLE user_roles(user_id uuid,role text) ON COMMIT DROP;
      CREATE TEMP TABLE disciplinary_actions(LIKE public.disciplinary_actions INCLUDING DEFAULTS) ON COMMIT DROP;
      ALTER TABLE disciplinary_actions ADD UNIQUE(user_id,warning_type,period_month);
      CREATE TEMP TABLE account_locks(LIKE public.account_locks INCLUDING DEFAULTS) ON COMMIT DROP;
      CREATE OR REPLACE FUNCTION pg_temp.caller_role() RETURNS text LANGUAGE sql AS $$SELECT 'service_role'::text$$;
      CREATE OR REPLACE FUNCTION pg_temp.caller() RETURNS uuid LANGUAGE sql AS $$SELECT '00000000-0000-0000-0000-000000000001'::uuid$$;
      CREATE OR REPLACE FUNCTION pg_temp.is_discipline_admin() RETURNS boolean LANGUAGE sql AS $$SELECT true$$;
      CREATE OR REPLACE FUNCTION pg_temp.has_role(uuid,public.app_role) RETURNS boolean LANGUAGE sql AS $$SELECT false$$;
      CREATE OR REPLACE FUNCTION pg_temp.get_attendance_discipline_config() RETURNS jsonb LANGUAGE sql AS $$SELECT '{"sp1_threshold":5,"sp2_threshold":8,"lock_threshold":11}'::jsonb$$;
      CREATE OR REPLACE FUNCTION pg_temp.late_reason_deadline_hours() RETURNS integer LANGUAGE sql AS $$SELECT 24$$;
      CREATE OR REPLACE FUNCTION pg_temp.fake_now() RETURNS timestamptz LANGUAGE sql AS $$SELECT '2026-11-16 10:00+07'::timestamptz$$;
      CREATE OR REPLACE FUNCTION pg_temp.get_monthly_violation_count(uuid,date) RETURNS integer LANGUAGE sql AS $$SELECT count(*)::integer FROM pg_temp.attendance_violations WHERE user_id=$1 AND is_counted AND date_trunc('month',violation_date)=date_trunc('month',$2)$$;
      CREATE OR REPLACE FUNCTION pg_temp.get_rolling_3month_violation_count(uuid,date) RETURNS integer LANGUAGE sql AS $$SELECT 0$$;
      INSERT INTO profiles VALUES('00000000-0000-0000-0000-000000000001','Active',NULL,'active');
      INSERT INTO attendance VALUES('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','terlambat',1,'2026-11-15 14:00+07');
    `);
    await tx`DROP FUNCTION IF EXISTS pg_temp.create_attendance_violation(uuid,uuid,date,text,text,text,uuid)`;
    const [constraint]=await tx`SELECT pg_get_constraintdef(oid) d FROM pg_constraint WHERE conrelid='public.attendance_notifications'::regclass AND conname='attendance_notifications_notif_type_check'`;
    await tx.unsafe(`ALTER TABLE attendance_notifications ADD ${constraint.d}`);
    for(const name of ['check_attendance_thresholds','notify_counted_attendance_violation','create_attendance_violation','notify_late_reason_decision','approve_late_reason','reject_late_reason','send_late_reason_reminders']) {
      const [fn]=await tx`SELECT pg_get_functiondef(oid) d FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=${name}`;
      if(!fn) throw new Error(`Missing ${name}`);
      await tx.unsafe(fn.d.replace(/SECURITY DEFINER/g,'SECURITY INVOKER').replace(/public\.(?!app_role\b)/g,'pg_temp.').replace(/auth\.uid\(\)/g,'pg_temp.caller()').replace(/auth\.role\(\)/g,'pg_temp.caller_role()').replace(/clock_timestamp\(\)/g,'pg_temp.fake_now()'));
    }
    await tx`CREATE TRIGGER notices AFTER INSERT ON attendance_violations FOR EACH ROW EXECUTE FUNCTION pg_temp.notify_counted_attendance_violation()`;
    await check(tx);
    await tx`DROP FUNCTION pg_temp.create_attendance_violation(uuid,uuid,date,text,text,text,uuid)`;
    // Roll back test functions too: pooled connections retain pg_temp functions after commit.
    throw new Error('ROLLBACK_NOTIFICATION_TEST');
  }); } catch (error) { if (error.message !== 'ROLLBACK_NOTIFICATION_TEST') throw error; } finally { await sql.end(); }
}
const employee='00000000-0000-0000-0000-000000000001';
async function reason(tx) {
  const [r]=await tx`INSERT INTO late_reasons(user_id,attendance_id,reason,submitted_at) SELECT user_id,id,'Ban bocor','2026-11-16 09:00+07' FROM attendance RETURNING id`;
  return r.id;
}
async function violation(tx) {
  await tx`SELECT pg_temp.create_attendance_violation(${employee},'00000000-0000-0000-0000-000000000002','2026-11-15','late_no_reason_submitted','Tidak mengirim alasan','system',NULL)`;
}
test('approved reason delivers once to employee for attendance date, not submission date',()=>isolated(async tx=>{
  const id=await reason(tx);
  await tx`SELECT pg_temp.approve_late_reason(${id},'Diterima')`;
  await tx`SELECT pg_temp.notify_late_reason_decision(${id})`;
  const rows=await tx`SELECT * FROM attendance_notifications`;
  expect(rows).toHaveLength(1);
  expect(rows[0].notif_type).toBe('late_reason_approved');
  expect(rows[0].target_role).toBe('employee');
  expect(rows[0].attendance_date.toISOString().slice(0,10)).toBe('2026-11-15');
  expect(rows[0].attendance_id).toBe('00000000-0000-0000-0000-000000000002');
  expect(await tx`SELECT * FROM attendance_violations WHERE is_counted`).toHaveLength(0);
}));
test('HR rejection includes HR note and one counted violation, no duplicate employee notification',()=>isolated(async tx=>{
  const id=await reason(tx);
  await tx`SELECT pg_temp.reject_late_reason(${id},'Bukti tidak sesuai')`;
  await tx`SELECT pg_temp.notify_late_reason_decision(${id})`;
  const rows=await tx`SELECT * FROM attendance_notifications`;
  expect(rows).toHaveLength(1);
  expect(rows[0].notif_type).toBe('late_reason_rejected');
  expect(rows[0].target_role).toBe('employee');
  expect(rows[0].attendance_date.toISOString().slice(0,10)).toBe('2026-11-15');
  const v=await tx`SELECT * FROM attendance_violations WHERE is_counted`;
  expect(v).toHaveLength(1);
  expect(v[0].violation_date.toISOString().slice(0,10)).toBe('2026-11-15');
  expect(v[0].description).toContain('Bukti tidak sesuai');
}));
test('reminder is sent exactly once at four hours remaining',()=>isolated(async tx=>{
  expect((await tx`SELECT pg_temp.send_late_reason_reminders() n`)[0].n).toBe(1);
  expect((await tx`SELECT pg_temp.send_late_reason_reminders() n`)[0].n).toBe(0);
  const rows=await tx`SELECT * FROM attendance_notifications`;
  expect(rows).toHaveLength(1); expect(rows[0].notif_type).toBe('late_reason_reminder');
  expect(rows[0].target_role).toBe('employee'); expect(rows[0].attendance_date.toISOString().slice(0,10)).toBe('2026-11-15');
}));
for(const mode of ['five hours','expired','pending','approved','rejected']) test(`reminder skips ${mode}`,()=>isolated(async tx=>{
  if(mode==='five hours') await tx`UPDATE attendance SET check_in_time='2026-11-15 15:00+07'`;
  else if(mode==='expired') await tx`UPDATE attendance SET check_in_time='2026-11-15 09:00+07'`;
  else { const id=await reason(tx); await tx`UPDATE late_reasons SET status=${mode} WHERE id=${id}`; }
  expect((await tx`SELECT pg_temp.send_late_reason_reminders() n`)[0].n).toBe(0);
  expect(await tx`SELECT * FROM attendance_notifications`).toHaveLength(0);
}));
test('reminder uses configured 48-hour deadline',()=>isolated(async tx=>{
  await tx`CREATE OR REPLACE FUNCTION pg_temp.late_reason_deadline_hours() RETURNS integer LANGUAGE sql AS $$SELECT 48$$`;
  expect((await tx`SELECT pg_temp.send_late_reason_reminders() n`)[0].n).toBe(0);
  await tx`UPDATE attendance SET check_in_time='2026-11-14 14:00+07'`;
  expect((await tx`SELECT pg_temp.send_late_reason_reminders() n`)[0].n).toBe(1);
}));
test('new counted violation notifies once, monthly count is two, uncounted inserts are silent',()=>isolated(async tx=>{
  await tx`INSERT INTO attendance_violations(user_id,violation_date,violation_type,is_counted) VALUES(${employee},'2026-11-14','no_attendance_record',true)`;
  await violation(tx); await violation(tx);
  await tx`INSERT INTO attendance_violations(user_id,violation_date,violation_type,is_counted) VALUES(${employee},'2026-11-13','no_attendance_record',false)`;
  const rows=await tx`SELECT * FROM attendance_notifications WHERE attendance_date='2026-11-15'`;
  expect(rows).toHaveLength(1); expect(rows[0].notif_type).toBe('violation_recorded');
  expect(rows[0].target_role).toBe('employee');
  expect((await tx`SELECT pg_temp.get_monthly_violation_count(${employee},'2026-11-15') n`)[0].n).toBe(2);
  expect(await tx`SELECT * FROM attendance_notifications`).toHaveLength(2);
}));
for(const [count,type] of [[3,'monthly_violation_progress'],[5,'sp1_issued'],[8,'sp2_issued']]) test(`count ${count} merges existing ${type}, no second notice`,()=>isolated(async tx=>{
  await tx`ALTER TABLE attendance_violations DISABLE TRIGGER notices`;
  await tx`INSERT INTO attendance_violations(user_id,violation_date,violation_type,is_counted) SELECT ${employee}::uuid,'2026-11-14'::date,'no_attendance_record',true FROM generate_series(1,${count-1})`;
  await tx`ALTER TABLE attendance_violations ENABLE TRIGGER notices`;
  await violation(tx);
  const rows=await tx`SELECT * FROM attendance_notifications WHERE target_role='employee'`;
  expect(rows).toHaveLength(1); expect(rows[0].notif_type).toBe(type);
  expect(rows[0].attendance_date.toISOString().slice(0,10)).toBe('2026-11-15'); expect(rows[0].event_key).not.toBeNull();
}));
test('existing notifications remain unchanged and all previous types are still accepted',()=>isolated(async tx=>{
  const types=['late_reason_pending','monthly_violation_progress','sp1_issued','sp2_issued','lock_warning','account_locked','account_unlocked','rolling_3month_warning','unlock_letter_submitted','unlock_letter_approved','unlock_letter_rejected','warning_corrected'];
  for(const type of types) await tx`INSERT INTO attendance_notifications(user_id,notif_type,title,message,target_role) VALUES(${employee},${type},'Existing','Existing','employee')`;
  const before=await tx`SELECT * FROM attendance_notifications ORDER BY id`;
  await violation(tx);
  const after=await tx`SELECT * FROM attendance_notifications WHERE event_key IS NULL ORDER BY id`;
  expect(after).toEqual(before);
}));
