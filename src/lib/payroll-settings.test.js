import { test, expect } from 'bun:test';
import postgres from 'postgres';

async function isolated(admin, check) {
  if (!process.env.SUPABASE_DB_URL) throw new Error('Database connection required');
  const sql = postgres(process.env.SUPABASE_DB_URL, { max:1, prepare:false });
  try {
    await sql.begin(async tx => {
      await tx.unsafe(`CREATE TEMP TABLE system_settings(key text PRIMARY KEY,value jsonb,description text,updated_at timestamptz DEFAULT now()) ON COMMIT DROP;
      CREATE OR REPLACE FUNCTION pg_temp.caller() RETURNS uuid LANGUAGE sql AS $$SELECT '00000000-0000-0000-0000-000000000001'::uuid$$;
      CREATE OR REPLACE FUNCTION pg_temp.has_role(uuid,public.app_role) RETURNS boolean LANGUAGE sql AS $$SELECT ${admin ? 'true' : 'false'}$$;`);
      const [fn] = await tx`SELECT pg_get_functiondef(oid) AS definition FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='save_payroll_wage_bases'`;
      if (!fn) throw new Error('Missing installed payroll setting rule');
      await tx.unsafe(fn.definition.replace(/SECURITY DEFINER/g,'SECURITY INVOKER').replace(/public\.(save_payroll_wage_bases|system_settings|has_role)/g,'pg_temp.$1').replace(/auth\.uid\(\)/g,'pg_temp.caller()'));
      await check(tx);
    });
  } finally { await sql.end(); }
}

test('employees cannot change payroll wage bases',async()=>{
  await expect(isolated(false,async tx=>{await tx`SELECT pg_temp.save_payroll_wage_bases('basic_only','basic_only')`;})).rejects.toThrow('Administrator required');
});
test('administrator can save independent overtime and THR choices',async()=>{
  await isolated(true,async tx=>{await tx`SELECT pg_temp.save_payroll_wage_bases('basic_plus_fixed','basic_only')`;const rows=await tx`SELECT key,value FROM pg_temp.system_settings ORDER BY key`;expect(rows).toEqual([{key:'overtime_base',value:'basic_plus_fixed'},{key:'thr_base',value:'basic_only'}]);});
});
test('invalid wage base does not get saved',async()=>{
  await expect(isolated(true,async tx=>{await tx`SELECT pg_temp.save_payroll_wage_bases('basic_plus_fixed','invalid')`;})).rejects.toThrow('Invalid wage base');
});