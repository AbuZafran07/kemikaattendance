import { test, expect } from "bun:test";
import postgres from "postgres";

export async function isolated(check) {
  if (!process.env.SUPABASE_DB_URL) throw new Error("Database connection required");
  const sql = postgres(process.env.SUPABASE_DB_URL, {max:1,prepare:false});
  try {
    await sql.begin(async tx => {
      await tx.unsafe(`
        CREATE TEMP TABLE profiles(id uuid,status text,departemen text,account_status text) ON COMMIT DROP;
        CREATE TEMP TABLE attendance(id uuid,user_id uuid,status text,late_minutes integer,check_in_time timestamptz) ON COMMIT DROP;
        CREATE TEMP TABLE late_reasons(id uuid DEFAULT gen_random_uuid(),attendance_id uuid,user_id uuid,status text DEFAULT 'pending',reason text,submitted_at timestamptz DEFAULT '2026-11-16 09:59+07',description text,attachment_url text) ON COMMIT DROP;
        CREATE TEMP TABLE user_roles(user_id uuid,role text) ON COMMIT DROP;
        CREATE TEMP TABLE attendance_violations(id uuid,user_id uuid,attendance_id uuid,late_reason_id uuid,violation_date date,violation_type text,is_counted boolean) ON COMMIT DROP;
        CREATE TEMP TABLE disciplinary_actions(id uuid DEFAULT gen_random_uuid(),user_id uuid,period_month date,status text DEFAULT 'active',warning_type text,violation_count_at_issuance integer,issue_date timestamptz DEFAULT now(),document_url text,UNIQUE(user_id,warning_type,period_month)) ON COMMIT DROP;
        CREATE TEMP TABLE account_locks(id uuid,user_id uuid,status text,locked_at timestamptz,reason text,unlocked_at timestamptz,unlocked_by uuid) ON COMMIT DROP;
        CREATE TEMP TABLE attendance_audit_logs(attendance_id uuid,action_type text,changed_by uuid,old_data jsonb,new_data jsonb,reason text) ON COMMIT DROP;
        CREATE TEMP TABLE attendance_notifications(user_id uuid,notif_type text,title text,message text,related_id uuid,target_role text) ON COMMIT DROP;
        CREATE OR REPLACE FUNCTION pg_temp.late_reason_deadline_hours() RETURNS integer LANGUAGE sql AS $$SELECT 24$$;
        CREATE OR REPLACE FUNCTION pg_temp.caller_role() RETURNS text LANGUAGE sql AS $$SELECT 'service_role'::text$$;
        CREATE OR REPLACE FUNCTION pg_temp.caller() RETURNS uuid LANGUAGE sql AS $$SELECT '00000000-0000-0000-0000-000000000001'::uuid$$;
        CREATE OR REPLACE FUNCTION pg_temp.has_role(uuid,public.app_role) RETURNS boolean LANGUAGE sql AS $$SELECT false$$;
        CREATE OR REPLACE FUNCTION pg_temp.is_discipline_admin() RETURNS boolean LANGUAGE sql AS $$SELECT true$$;
        CREATE OR REPLACE FUNCTION pg_temp.get_attendance_discipline_config() RETURNS jsonb LANGUAGE sql AS $$SELECT '{"sp1_threshold":5,"sp2_threshold":8,"lock_threshold":11}'::jsonb$$;
        CREATE OR REPLACE FUNCTION pg_temp.get_monthly_violation_count(uuid,date) RETURNS integer LANGUAGE sql AS $$SELECT count(*)::integer FROM pg_temp.attendance_violations WHERE user_id=$1 AND is_counted AND date_trunc('month',violation_date)=date_trunc('month',$2)$$;
        CREATE OR REPLACE FUNCTION pg_temp.fake_now() RETURNS timestamptz LANGUAGE sql AS $$SELECT '2026-11-16 10:00+07'::timestamptz$$;
        CREATE OR REPLACE FUNCTION pg_temp.create_attendance_violation(uuid,uuid,date,text,text,text,uuid) RETURNS uuid LANGUAGE plpgsql AS $$BEGIN INSERT INTO pg_temp.attendance_violations VALUES(gen_random_uuid(),$1,$2,$7,$3,$4,true); RETURN $1; END$$;
        INSERT INTO profiles VALUES('00000000-0000-0000-0000-000000000001','Active',NULL,'active');
        INSERT INTO attendance VALUES('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','terlambat',1,'2026-11-15 09:59+07');
      `);
      for (const name of ["scan_missing_late_reasons","reconcile_attendance_discipline","reconcile_submitted_late_reason","submit_late_reason","protect_late_reason_violation_count","waive_attendance_violation","check_attendance_thresholds"]) {
        const [fn] = await tx`SELECT pg_get_functiondef(oid) definition FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=${name}`;
        if (!fn) throw new Error(`Missing ${name}`);
        await tx.unsafe(fn.definition.replace(/SECURITY DEFINER/g,"SECURITY INVOKER")
          .replace(/public\.(late_reason_deadline_hours|user_roles|submit_late_reason|protect_late_reason_violation_count|waive_attendance_violation|check_attendance_thresholds|scan_missing_late_reasons|reconcile_attendance_discipline|reconcile_submitted_late_reason|profiles|attendance\b|late_reasons|attendance_violations|disciplinary_actions|account_locks|attendance_audit_logs|attendance_notifications|has_role|is_discipline_admin|get_attendance_discipline_config|get_monthly_violation_count|create_attendance_violation)/g,"pg_temp.$1")
          .replace(/auth\.role\(\)/g,"pg_temp.caller_role()").replace(/auth\.uid\(\)/g,"pg_temp.caller()").replace(/clock_timestamp\(\)/g,"pg_temp.fake_now()"));
      }
      await tx`CREATE TRIGGER reconcile AFTER INSERT OR UPDATE OF status ON late_reasons FOR EACH ROW EXECUTE FUNCTION pg_temp.reconcile_submitted_late_reason()`;
      await tx`CREATE TRIGGER protect_count BEFORE INSERT OR UPDATE ON attendance_violations FOR EACH ROW EXECUTE FUNCTION pg_temp.protect_late_reason_violation_count()`;
      const [constraint] = await tx`SELECT pg_get_constraintdef(oid) definition FROM pg_constraint WHERE conrelid='public.attendance_notifications'::regclass AND conname='attendance_notifications_notif_type_check'`;
      if (!constraint) throw new Error("Missing notification constraint");
      await tx.unsafe(`ALTER TABLE pg_temp.attendance_notifications ADD ${constraint.definition}`);
      await check(tx);
    });
  } finally { await sql.end(); }
}
test("no reason is counted at 24 hours once, even on weekends",async()=>isolated(async tx=>{
  const [first]=await tx`SELECT pg_temp.scan_missing_late_reasons() n`;
  const [second]=await tx`SELECT pg_temp.scan_missing_late_reasons() n`;
  expect(first.n).toBe(1); expect(second.n).toBe(0);
}));
test("before 24 hours is not counted",async()=>isolated(async tx=>{
  await tx`UPDATE attendance SET check_in_time='2026-11-15 10:01+07'`;
  const [row]=await tx`SELECT pg_temp.scan_missing_late_reasons() n`;
  expect(row.n).toBe(0);
}));
for(const status of ['pending','approved','rejected']) test(`${status} submission is not classified as missing`,async()=>isolated(async tx=>{
  await tx`INSERT INTO late_reasons(id,attendance_id,user_id,status,reason) SELECT gen_random_uuid(),id,user_id,${status},'Alasan terkirim' FROM attendance`;
  const [row]=await tx`SELECT pg_temp.scan_missing_late_reasons() n`;
  expect(row.n).toBe(0);
}));
test("early checkout retains missing-late-reason detection",async()=>isolated(async tx=>{
  await tx`UPDATE attendance SET status='pulang_cepat'`;
  const [row]=await tx`SELECT pg_temp.scan_missing_late_reasons() n`;
  expect(row.n).toBe(1);
}));
test("submission deactivates timeout violation, SP1/SP2 and automatic lock with audit history",async()=>isolated(async tx=>{
  await tx`SELECT pg_temp.scan_missing_late_reasons()`;
  await tx`INSERT INTO disciplinary_actions(id,user_id,period_month,status,warning_type) SELECT gen_random_uuid(),user_id,'2026-11-01','active',x FROM attendance CROSS JOIN unnest(ARRAY['sp1','sp2']) x`;
  await tx`INSERT INTO account_locks SELECT gen_random_uuid(),user_id,'locked','2026-11-15 18:00+07','Akun dikunci otomatis karena mencapai 11 pelanggaran',NULL,NULL FROM attendance`;
  await tx`UPDATE profiles SET account_status='locked'`;
  await tx`INSERT INTO late_reasons(id,attendance_id,user_id,status,reason) SELECT gen_random_uuid(),id,user_id,'pending','Ban bocor' FROM attendance`;
  expect((await tx`SELECT * FROM attendance_violations WHERE is_counted`)).toHaveLength(0);
  expect((await tx`SELECT * FROM disciplinary_actions WHERE status='superseded'`)).toHaveLength(2);
  expect((await tx`SELECT * FROM account_locks WHERE status='unlocked'`)).toHaveLength(1);
  expect((await tx`SELECT account_status FROM profiles`)[0].account_status).toBe('active');
  expect((await tx`SELECT * FROM attendance_audit_logs`)).toHaveLength(4);
}));
test("valid SP1 at 5 counted violations and manual locks are preserved",async()=>isolated(async tx=>{
  await tx`INSERT INTO attendance_violations SELECT gen_random_uuid(),user_id,id,NULL,'2026-11-15','absent_without_permission',true FROM attendance CROSS JOIN generate_series(1,5)`;
  await tx`INSERT INTO disciplinary_actions(id,user_id,period_month,status,warning_type) SELECT gen_random_uuid(),user_id,'2026-11-01','active','sp1' FROM attendance`;
  await tx`INSERT INTO account_locks SELECT gen_random_uuid(),user_id,'locked','2026-11-15 18:00+07','Kunci manual HR',NULL,NULL FROM attendance`;
  await tx`SELECT pg_temp.reconcile_attendance_discipline(user_id,'2026-11-15',id) FROM attendance`;
  expect((await tx`SELECT * FROM disciplinary_actions WHERE status='active'`)).toHaveLength(1);
  expect((await tx`SELECT * FROM account_locks WHERE status='locked'`)).toHaveLength(1);
}));
test("HR waiver survives rescanning: zero new violations, SP stays revoked and no new SP notification",async()=>isolated(async tx=>{
  await tx`CREATE OR REPLACE FUNCTION pg_temp.get_rolling_3month_violation_count(uuid,date) RETURNS integer LANGUAGE sql AS $$SELECT 0$$`;
  const [fn]=await tx`SELECT pg_get_functiondef(oid) d FROM pg_proc WHERE pronamespace=pg_my_temp_schema() AND proname='check_attendance_thresholds'`;
  await tx.unsafe(fn.d.replace(/public.get_rolling_3month_violation_count/g,'pg_temp.get_rolling_3month_violation_count'));
  await tx.unsafe(`CREATE OR REPLACE FUNCTION pg_temp.create_attendance_violation(uuid,uuid,date,text,text,text,uuid) RETURNS uuid LANGUAGE plpgsql AS $$
    DECLARE violation_id uuid:=gen_random_uuid(); BEGIN
      INSERT INTO pg_temp.attendance_violations VALUES(violation_id,$1,$2,$7,$3,$4,true);
      PERFORM pg_temp.check_attendance_thresholds($1,$3);
      RETURN violation_id;
    END$$`);
  await tx`INSERT INTO attendance_violations SELECT gen_random_uuid(),user_id,NULL,NULL,'2026-11-10'::date+x,'absent_without_permission',true FROM attendance CROSS JOIN generate_series(0,3) x`;
  expect((await tx`SELECT pg_temp.scan_missing_late_reasons() n`)[0].n).toBe(1);
  expect(await tx`SELECT * FROM disciplinary_actions WHERE status='active' AND warning_type='sp1'`).toHaveLength(1);
  await tx`SELECT pg_temp.waive_attendance_violation(id,'Koreksi HR: bukti keterlambatan terverifikasi') FROM attendance_violations WHERE violation_type='late_no_reason_submitted'`;
  expect(await tx`SELECT * FROM disciplinary_actions WHERE status='superseded' AND warning_type='sp1'`).toHaveLength(1);
  const notificationsBefore=await tx`SELECT * FROM attendance_notifications WHERE notif_type IN ('sp1_issued','sp2_issued')`;
  expect(notificationsBefore.length).toBeGreaterThan(0);
  expect((await tx`SELECT pg_temp.scan_missing_late_reasons() n`)[0].n).toBe(0);
  expect((await tx`SELECT pg_temp.scan_missing_late_reasons() n`)[0].n).toBe(0);
  expect(await tx`SELECT * FROM attendance_violations`).toHaveLength(5);
  expect(await tx`SELECT * FROM attendance_violations WHERE is_counted`).toHaveLength(4);
  expect(await tx`SELECT * FROM disciplinary_actions WHERE status='active'`).toHaveLength(0);
  expect(await tx`SELECT * FROM disciplinary_actions WHERE status='superseded' AND warning_type='sp1'`).toHaveLength(1);
  expect(await tx`SELECT * FROM attendance_notifications WHERE notif_type IN ('sp1_issued','sp2_issued')`).toHaveLength(notificationsBefore.length);
}));
for(const counted of [true,false]) test(`any prior attendance violation blocks missing-reason scan (counted=${counted})`,async()=>isolated(async tx=>{
  await tx`INSERT INTO attendance_violations SELECT gen_random_uuid(),user_id,id,NULL,'2026-11-14','leave_rejected',${counted} FROM attendance`;
  expect((await tx`SELECT pg_temp.scan_missing_late_reasons() n`)[0].n).toBe(0);
  expect(await tx`SELECT * FROM attendance_violations`).toHaveLength(1);
}));
test("counted violation on same date still blocks a different attendance row",async()=>isolated(async tx=>{
  await tx`INSERT INTO attendance_violations SELECT gen_random_uuid(),user_id,gen_random_uuid(),NULL,'2026-11-15','absent_without_permission',true FROM attendance`;
  expect((await tx`SELECT pg_temp.scan_missing_late_reasons() n`)[0].n).toBe(0);
  expect(await tx`SELECT * FROM attendance_violations`).toHaveLength(1);
}));