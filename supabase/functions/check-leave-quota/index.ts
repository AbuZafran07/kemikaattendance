import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

const FIREBASE_SERVER_KEY = Deno.env.get('FIREBASE_SERVER_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

interface LowQuotaEmployee {
  user_id: string;
  full_name: string;
  remaining_leave: number;
}

async function sendFCMNotification(fcmToken: string, title: string, body: string) {
  if (!FIREBASE_SERVER_KEY) {
    console.log('Firebase server key not configured, skipping notification');
    return null;
  }

  try {
    const response = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `key=${FIREBASE_SERVER_KEY}`
      },
      body: JSON.stringify({
        to: fcmToken,
        notification: {
          title,
          body,
          icon: '/logo.png'
        },
        data: {
          type: 'leave_quota_reminder'
        }
      })
    });

    return await response.json();
  } catch (error) {
    return null;
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase configuration missing');
    }

    // Verify the requesting user is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get the user from the JWT token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has admin role
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || roleData?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Only admins can send leave quota reminders' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get threshold from request body or use default (3 days)
    let threshold = 3;
    try {
      const body = await req.json();
      if (body.threshold && typeof body.threshold === 'number' && body.threshold > 0) {
        threshold = body.threshold;
      }
    } catch {
      // Use default threshold if no body
    }

    console.log(`[AUDIT] Admin checking employees with leave quota <= ${threshold} days`);

    // Get employees with low leave quota (no longer returns FCM tokens or emails)
    const { data: employees, error } = await supabase
      .rpc('get_low_leave_quota_employees', { threshold });

    if (error) {
      throw error;
    }

    console.log(`Found ${employees?.length || 0} employees with low quota`);

    const notifications: { employee: string; success: boolean; remaining: number }[] = [];

    // Send notifications to each employee - fetch FCM token separately for each
    for (const employee of (employees as LowQuotaEmployee[]) || []) {
      // Fetch FCM token directly using service role (not exposed via RPC)
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('fcm_token')
        .eq('id', employee.user_id)
        .single();

      if (profileError || !profileData?.fcm_token) {
        notifications.push({
          employee: employee.full_name,
          success: false,
          remaining: employee.remaining_leave
        });
        continue;
      }

      const title = '⚠️ Reminder Kuota Cuti';
      const body = `Halo ${employee.full_name}, sisa kuota cuti tahunan Anda tinggal ${employee.remaining_leave} hari. Silakan rencanakan penggunaan cuti Anda dengan bijak.`;
      
      const result = await sendFCMNotification(profileData.fcm_token, title, body);
      
      notifications.push({
        employee: employee.full_name,
        success: result !== null,
        remaining: employee.remaining_leave
      });
    }

    console.log(`[AUDIT] Admin sent ${notifications.filter(n => n.success).length}/${notifications.length} leave quota reminders`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sent ${notifications.filter(n => n.success).length} notifications`,
        notifications 
      }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[CHECK-LEAVE-QUOTA] Internal error:', message);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
