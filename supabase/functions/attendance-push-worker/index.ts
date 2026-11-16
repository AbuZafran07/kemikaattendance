import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { authenticateCronRequest } from '../_shared/cron-auth.ts';
import { attendancePushStore, drainAttendancePush } from '../_shared/attendance-push.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const denied = authenticateCronRequest(req);
  if (denied) return denied;
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) throw new Error('Missing configuration');
    const client = createClient(url, key);
    // Also catches SQL-only cron/trigger inserts and browser-independent HR decisions.
    for (const rpc of ['scan_missing_late_reasons', 'send_late_reason_reminders']) {
      const { error } = await client.rpc(rpc);
      if (error) { console.error('Attendance push RPC failed', rpc, error.code); throw error; }
    }
    const result = await drainAttendancePush(attendancePushStore(client));
    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Attendance push worker failed', error instanceof Error ? error.message : (error as { code?: string })?.code);
    return new Response(JSON.stringify({ error: 'Pengiriman push belum berhasil' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});