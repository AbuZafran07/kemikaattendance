import { test, expect } from "bun:test";
import postgres from "postgres";

const employee = "00000000-0000-0000-0000-000000000001";

async function isolated(check) {
  if (!process.env.SUPABASE_DB_URL) throw new Error("Database connection required");
  const sql = postgres(process.env.SUPABASE_DB_URL, { max: 1, prepare: false });
  try {
    await sql.begin(async (tx) => {
      await tx.unsafe(`
        DROP TABLE IF EXISTS pg_temp.config, pg_temp.system_settings, pg_temp.profiles, pg_temp.attendance, pg_temp.leave_requests, pg_temp.business_travel_requests, pg_temp.violations CASCADE;
        CREATE TEMP TABLE config(server_now timestamptz, admin boolean, hr boolean DEFAULT false) ON COMMIT DROP;
        INSERT INTO config(server_now,admin) VALUES ('2026-11-16 08:16:00+07',false);
        CREATE TEMP TABLE system_settings(key text,value jsonb) ON COMMIT DROP;
        INSERT INTO system_settings VALUES ('work_hours','{"check_in_end":"08:00","late_tolerance_minutes":15,"check_out_start":"17:00","check_out_end":"17:00","early_leave_tolerance_minutes":0,"friday_enabled":true,"friday_check_out_start":"16:00","friday_check_out_end":"16:00"}'),('overtime_policy','{"holidays":[{"date":"2026-11-11"}]}');
        CREATE TEMP TABLE profiles(id uuid,status text,account_status text,departemen text,join_date date,resign_date date) ON COMMIT DROP;
        INSERT INTO profiles VALUES ('${employee}','Active','active','Operations','2020-01-01',NULL);
        CREATE TEMP TABLE attendance(user_id uuid,check_in_time timestamptz,check_out_time timestamptz,created_at timestamptz,duration_minutes integer,late_minutes integer,status public.attendance_status) ON COMMIT DROP;
        CREATE TEMP TABLE leave_requests(user_id uuid,status text,start_date date,end_date date) ON COMMIT DROP;
        CREATE TEMP TABLE business_travel_requests(LIKE leave_requests) ON COMMIT DROP;
        CREATE TEMP TABLE violations(user_id uuid,violation_date date,violation_type text) ON COMMIT DROP;
        CREATE OR REPLACE FUNCTION pg_temp.fake_now() RETURNS timestamptz LANGUAGE sql AS 'SELECT server_now FROM pg_temp.config';
        CREATE OR REPLACE FUNCTION pg_temp.caller() RETURNS uuid LANGUAGE sql AS $$ SELECT '${employee}'::uuid $$;
        CREATE OR REPLACE FUNCTION pg_temp.caller_role() RETURNS text LANGUAGE sql AS $$ SELECT 'authenticated'::text $$;
        CREATE OR REPLACE FUNCTION pg_temp.has_role(uuid,public.app_role) RETURNS boolean LANGUAGE sql AS 'SELECT admin FROM pg_temp.config';
        CREATE OR REPLACE FUNCTION pg_temp.is_discipline_admin() RETURNS boolean LANGUAGE sql AS 'SELECT admin OR hr FROM pg_temp.config';
        CREATE OR REPLACE FUNCTION pg_temp.create_attendance_violation(uuid,uuid,date,text,text,text,uuid) RETURNS uuid LANGUAGE plpgsql AS $$ BEGIN
          INSERT INTO pg_temp.violations SELECT $1,$3,$4 WHERE NOT EXISTS(SELECT 1 FROM pg_temp.violations WHERE user_id=$1 AND violation_date=$3); RETURN $1;
        END; $$;
      `);
      for (const name of ["get_work_hours_for_date", "enforce_employee_attendance_clock", "recheck_rejected_attendance_request"]) {
        const [fn] = await tx`SELECT pg_get_functiondef(oid) AS definition FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=${name}`;
        if (!fn) throw new Error(`Missing installed rule: ${name}`);
        const definition = fn.definition.replace(/SECURITY DEFINER/g, "SECURITY INVOKER")
          .replace(/public\.(get_work_hours_for_date|enforce_employee_attendance_clock|recheck_rejected_attendance_request|profiles|system_settings|attendance\b|leave_requests|business_travel_requests|has_role|is_discipline_admin|create_attendance_violation)/g, "pg_temp.$1")
          .replace(/clock_timestamp\(\)/g, "pg_temp.fake_now()")
          .replace(/auth\.uid\(\)/g, "pg_temp.caller()")
          .replace(/auth\.role\(\)/g, "pg_temp.caller_role()");
        await tx.unsafe(definition);
      }
      await tx.unsafe(`
        CREATE TRIGGER clock BEFORE INSERT OR UPDATE ON attendance FOR EACH ROW EXECUTE FUNCTION pg_temp.enforce_employee_attendance_clock();
        CREATE TRIGGER recheck AFTER UPDATE OF status ON leave_requests FOR EACH ROW EXECUTE FUNCTION pg_temp.recheck_rejected_attendance_request();
        CREATE TRIGGER recheck AFTER UPDATE OF status ON business_travel_requests FOR EACH ROW EXECUTE FUNCTION pg_temp.recheck_rejected_attendance_request();
      `);
      await check(tx);
    });
  } finally { await sql.end(); }
}

test("changing phone time cannot hide a check-in 1 minute after the 08:15 threshold", async () => {
  await isolated(async (tx) => {
    const [row] = await tx`INSERT INTO attendance(user_id,check_in_time,status,late_minutes) VALUES(${employee},'2026-11-16 07:00+07','hadir',0) RETURNING *, check_in_time='2026-11-16 08:16+07'::timestamptz AS server_time`;
    expect(row.server_time).toBe(true);
    expect(row.status).toBe("terlambat");
    expect(row.late_minutes).toBe(1);
    await tx`UPDATE attendance SET check_in_time='2026-11-16 07:00+07',status='hadir',late_minutes=0`;
    const [saved] = await tx`SELECT status,late_minutes FROM attendance`;
    expect(saved.status).toBe("terlambat");
    expect(saved.late_minutes).toBe(1);
  });
});
test("checkout uses server time and duration, ignoring a phone reporting 18:00", async () => {
  await isolated(async (tx) => {
    await tx`INSERT INTO attendance(user_id,status) VALUES(${employee},'hadir')`;
    await tx`UPDATE config SET server_now='2026-11-16 16:00+07'`;
    const [row] = await tx`UPDATE attendance SET check_out_time='2026-11-16 18:00+07',duration_minutes=999,status='hadir' RETURNING status,duration_minutes,check_out_time='2026-11-16 16:00+07'::timestamptz AS server_time`;
    expect(row.server_time).toBe(true);
    expect(row.duration_minutes).toBe(464);
    expect(row.status).toBe("pulang_cepat");
  });
});
test("Friday and special-period hours override normal hours", async () => {
  await isolated(async (tx) => {
    const [fri] = await tx`SELECT pg_temp.get_work_hours_for_date('2026-11-13')->>'check_out_end' AS cutoff`;
    expect(fri.cutoff).toBe("16:00");
    await tx`INSERT INTO system_settings VALUES('special_work_hours','{"periods":[{"is_active":true,"start_date":"2026-11-13","end_date":"2026-11-13","check_in_end":"08:30","late_tolerance_minutes":0,"check_out_end":"15:00","check_out_start":"15:00"}]}')`;
    await tx`UPDATE config SET server_now='2026-11-13 08:31+07'`;
    const [row] = await tx`INSERT INTO attendance(user_id,status) VALUES(${employee},'hadir') RETURNING status,late_minutes`;
    expect(row.status).toBe("terlambat");
    expect(row.late_minutes).toBe(1);
  });
});
for (const table of ["leave_requests", "business_travel_requests"]) {
  test(`${table}: next-day rejection rechecks the previous working date once`, async () => {
    await isolated(async (tx) => {
      await tx`UPDATE config SET server_now='2026-11-17 10:00+07'`;
      await tx`UPDATE config SET hr=true`;
      await tx.unsafe(`INSERT INTO ${table} VALUES('${employee}','pending','2026-11-16','2026-11-16'); UPDATE ${table} SET status='rejected'; UPDATE ${table} SET status='rejected';`);
      const rows = await tx`SELECT violation_date::text AS day,violation_type FROM violations`;
      expect(rows).toHaveLength(1);
      expect(rows[0].day).toBe("2026-11-16");
      expect(rows[0].violation_type).toBe("absent_without_permission");
    });
  });
}
test("recheck skips weekends, holidays, future dates and unfinished working days", async () => {
  await isolated(async (tx) => {
    await tx`UPDATE config SET hr=true`;
    await tx`INSERT INTO leave_requests VALUES(${employee},'pending','2026-11-11','2026-11-18')`;
    await tx`UPDATE leave_requests SET status='rejected'`;
    const rows = await tx`SELECT violation_date::text AS day FROM violations ORDER BY violation_date`;
    expect(rows.map(r => r.day)).toEqual(["2026-11-12", "2026-11-13"]);
  });
});
for (const status of ["pending", "approved"]) {
  test(`another ${status} request still protects the date`, async () => {
    await isolated(async (tx) => {
      await tx`UPDATE config SET hr=true`;
      await tx`INSERT INTO business_travel_requests VALUES(${employee},${status},'2026-11-12','2026-11-12')`;
      await tx`INSERT INTO leave_requests VALUES(${employee},'pending','2026-11-12','2026-11-12')`;
      await tx`UPDATE leave_requests SET status='rejected'`;
      expect(await tx`SELECT * FROM violations`).toHaveLength(0);
      if (status === "pending") {
        await tx`UPDATE business_travel_requests SET status='rejected'`;
        expect(await tx`SELECT * FROM violations`).toHaveLength(1);
      }
    });
  });
}
test("existing attendance prevents a rejected-request absence violation", async () => {
  await isolated(async (tx) => {
    await tx`UPDATE config SET admin=true`;
    await tx`INSERT INTO attendance(user_id,check_in_time,status) VALUES(${employee},'2026-11-12 08:00+07','hadir')`;
    await tx`UPDATE config SET admin=false,hr=true`;
    await tx`INSERT INTO leave_requests VALUES(${employee},'pending','2026-11-12','2026-11-12')`;
    await tx`UPDATE leave_requests SET status='rejected'`;
    expect(await tx`SELECT * FROM violations`).toHaveLength(0);
  });
});
test("BOD and inactive employees remain excluded", async () => {
  await isolated(async (tx) => {
    await tx`UPDATE config SET hr=true`;
    await tx`UPDATE profiles SET departemen='BOD'`;
    await tx`INSERT INTO leave_requests VALUES(${employee},'pending','2026-11-12','2026-11-12')`;
    await tx`UPDATE leave_requests SET status='rejected'`;
    expect(await tx`SELECT * FROM violations`).toHaveLength(0);
    await tx`UPDATE profiles SET departemen='Operations',status='Inactive'`;
    await tx`UPDATE leave_requests SET status='pending'`;
    await tx`UPDATE leave_requests SET status='rejected'`;
    expect(await tx`SELECT * FROM violations`).toHaveLength(0);
  });
});

test("HR can correct another employee's historical attendance", async () => {
  await isolated(async (tx) => {
    await tx`UPDATE config SET hr=true`;
    const [row] = await tx`INSERT INTO attendance(user_id,check_in_time,status) VALUES('00000000-0000-0000-0000-000000000009','2026-11-12 07:00+07','hadir') RETURNING check_in_time='2026-11-12 07:00+07'::timestamptz AS historical`;
    expect(row.historical).toBe(true);
  });
});
test("empty department does not block employee check-in", async () => {
  await isolated(async (tx) => {
    await tx`UPDATE profiles SET departemen=NULL`;
    const [row] = await tx`INSERT INTO attendance(user_id,status) VALUES(${employee},'hadir') RETURNING late_minutes`;
    expect(row.late_minutes).toBe(1);
  });
});
test("locked employee can finish checkout but cannot check in", async () => {
  await isolated(async (tx) => {
    await tx`INSERT INTO attendance(user_id,status) VALUES(${employee},'hadir')`;
    await tx`UPDATE profiles SET account_status='locked'`;
    await tx`UPDATE config SET server_now='2026-11-16 17:00+07'`;
    const [row] = await tx`UPDATE attendance SET check_out_time='2026-11-16 20:00+07' RETURNING duration_minutes`;
    expect(row.duration_minutes).toBe(524);
    await tx.savepoint(async (sp) => {
      await expect(sp`INSERT INTO attendance(user_id,status) VALUES(${employee},'hadir')`).rejects.toThrow('Attendance is unavailable');
      throw new Error('rollback expected denial');
    }).catch(e => { if (e.message !== 'rollback expected denial') throw e; });
  });
});