import { test, expect } from "bun:test";
import postgres from "postgres";

// Exercise the installed PostgreSQL trigger bodies against disposable tables.
// Never modify production employee records or grant test-runner access to them.
async function isolatedCase(check) {
  if (!process.env.SUPABASE_DB_URL) throw new Error("Database connection required");
  const sql = postgres(process.env.SUPABASE_DB_URL, { max: 1, prepare: false });
  try {
    await sql.begin(async (tx) => {
      await tx`CREATE TEMP TABLE late_reasons(id uuid,attendance_id uuid,status text,reason text,submitted_at timestamptz) ON COMMIT DROP`;
      await tx`CREATE TEMP TABLE violations(late_reason_id uuid,attendance_id uuid,violation_type text,is_counted boolean) ON COMMIT DROP`;
      for (const name of ["protect_submitted_late_reason_status", "protect_late_reason_violation_count"]) {
        const [fn] = await tx`SELECT pg_get_functiondef(oid) AS definition FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=${name}`;
        if (!fn) throw new Error("Protection trigger not installed");
        const definition = fn.definition
          .replace(`public.${name}`, `pg_temp.${name}`)
          .replace(/SECURITY DEFINER/g, "SECURITY INVOKER")
          .replace(/public\.late_reasons/g, "pg_temp.late_reasons");
        await tx.unsafe(definition);
      }
      await tx`CREATE TRIGGER protect_status BEFORE INSERT OR UPDATE ON late_reasons FOR EACH ROW EXECUTE FUNCTION pg_temp.protect_submitted_late_reason_status()`;
      await tx`CREATE TRIGGER protect_count BEFORE INSERT OR UPDATE ON violations FOR EACH ROW EXECUTE FUNCTION pg_temp.protect_late_reason_violation_count()`;
      await tx`INSERT INTO late_reasons VALUES('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','pending','Submitted reason',now()-interval '25 hours')`;
      await check(tx);
    });
  } finally {
    await sql.end();
  }
}

async function insertViolation(tx, linked = true) {
  const [row] = await tx`INSERT INTO violations VALUES(${linked ? "00000000-0000-0000-0000-000000000001" : null},'00000000-0000-0000-0000-000000000002','late_reason_rejected',true) RETURNING is_counted`;
  return row.is_counted;
}

test("a submitted reason remains pending after 24 hours despite a timeout worker", async () => {
  await isolatedCase(async (tx) => {
    const [row] = await tx`UPDATE late_reasons SET status='no_reason_submitted' RETURNING status,extract(epoch from now()-submitted_at)/3600 AS hours`;
    expect(Number(row.hours)).toBeGreaterThan(24);
    expect(row.status).toBe("pending");
  });
});
test("pending reasons cannot count as violations, even without an explicit reason link", async () => {
  await isolatedCase(async (tx) => {
    expect(await insertViolation(tx)).toBe(false);
    expect(await insertViolation(tx, false)).toBe(false);
  });
});
test("approval after 24 hours keeps violations uncounted", async () => {
  await isolatedCase(async (tx) => {
    await tx`UPDATE late_reasons SET status='approved'`;
    expect(await insertViolation(tx)).toBe(false);
  });
});
test("HR rejection still permits a counted violation", async () => {
  await isolatedCase(async (tx) => {
    await tx`UPDATE late_reasons SET status='rejected'`;
    expect(await insertViolation(tx)).toBe(true);
  });
});
