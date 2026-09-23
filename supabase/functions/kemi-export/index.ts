import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Timing-safe string comparison to prevent timing attacks on the secret
function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  const maxLen = Math.max(bufA.length, bufB.length);
  let diff = bufA.length ^ bufB.length;
  for (let i = 0; i < maxLen; i++) {
    diff |= (bufA[i % bufA.length] ?? 0) ^ (bufB[i % bufB.length] ?? 0);
  }
  return diff === 0;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    if (req.method !== 'GET') {
      return json({ error: 'Method not allowed' }, 405);
    }

    const expectedSecret = Deno.env.get('KEMI_EXPORT_SECRET');
    if (!expectedSecret) {
      console.error('[kemi-export] KEMI_EXPORT_SECRET not configured');
      return json({ error: 'Service not configured' }, 503);
    }

    const providedSecret = req.headers.get('x-kemi-secret') ?? '';
    if (!providedSecret || !timingSafeEqual(providedSecret, expectedSecret)) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Read-only summary data — deliberately excludes NIK, address, salary details,
    // bank accounts, and other personal/financial fields.
    const { data: employees, error: empError } = await supabase
      .from('profiles')
      .select('id, full_name, departemen, jabatan, status, join_date, resign_date, contract_type, work_type')
      .order('full_name', { ascending: true });

    if (empError) {
      console.error('[kemi-export] profiles query failed:', empError.message);
      return json({ error: 'Failed to fetch data' }, 500);
    }

    const rows = employees ?? [];
    const active = rows.filter((e) => e.status === 'Active');

    // Attendance for the last 30 days — date, name, department, status, late minutes.
    // No salary or personal data.
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceStr = since.toISOString().slice(0, 10);

    const { data: attendanceRows, error: attError } = await supabase
      .from('attendance')
      .select('user_id, check_in_time, status, late_minutes')
      .gte('check_in_time', `${sinceStr}T00:00:00+07:00`)
      .order('check_in_time', { ascending: false });

    if (attError) {
      console.error('[kemi-export] attendance query failed:', attError.message);
      return json({ error: 'Failed to fetch data' }, 500);
    }

    const profileMap = new Map(rows.map((e) => [e.id, e]));

    const attendance = (attendanceRows ?? [])
      .map((a) => {
        const p = profileMap.get(a.user_id);
        if (!p) return null;
        return {
          date: (a.check_in_time as string).slice(0, 10),
          full_name: p.full_name,
          department: p.departemen,
          status: a.status,
          late_minutes: a.late_minutes ?? 0,
        };
      })
      .filter(Boolean);

    return json({
      generated_at: new Date().toISOString(),
      summary: {
        total_employees: rows.length,
        active_employees: active.length,
        resigned_employees: rows.length - active.length,
        departments: [...new Set(rows.map((e) => e.departemen).filter(Boolean))].sort(),
      },
      employees: rows.map((e) => ({
        full_name: e.full_name,
        department: e.departemen,
        jabatan: e.jabatan,
        status: e.status,
        employment_type: e.contract_type,
        work_type: e.work_type,
        join_date: e.join_date,
        resign_date: e.resign_date,
      })),
      attendance,
    });
  } catch (error) {
    console.error('[kemi-export] unexpected error:', error);
    return json({ error: 'Internal server error' }, 500);
  }
});
