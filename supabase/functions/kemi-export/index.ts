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
      .select('id, employee_id, full_name, department, jabatan, status, join_date, resign_date, employment_type')
      .order('full_name', { ascending: true });

    if (empError) {
      console.error('[kemi-export] profiles query failed:', empError.message);
      return json({ error: 'Failed to fetch data' }, 500);
    }

    const rows = employees ?? [];
    const active = rows.filter((e) => e.status === 'active');

    return json({
      generated_at: new Date().toISOString(),
      summary: {
        total_employees: rows.length,
        active_employees: active.length,
        resigned_employees: rows.length - active.length,
        departments: [...new Set(rows.map((e) => e.department).filter(Boolean))].sort(),
      },
      employees: rows.map((e) => ({
        employee_id: e.employee_id,
        full_name: e.full_name,
        department: e.department,
        jabatan: e.jabatan,
        status: e.status,
        employment_type: e.employment_type,
        join_date: e.join_date,
        resign_date: e.resign_date,
      })),
    });
  } catch (error) {
    console.error('[kemi-export] unexpected error:', error);
    return json({ error: 'Internal server error' }, 500);
  }
});
