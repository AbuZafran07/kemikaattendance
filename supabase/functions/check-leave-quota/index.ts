import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FIREBASE_SERVER_KEY = Deno.env.get('FIREBASE_SERVER_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LowQuotaEmployee {
  user_id: string;
  full_name: string;
  email: string;
  remaining_leave: number;
  fcm_token: string;
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
    console.error('Error sending FCM notification:', error);
    return null;
  }
}

Deno.serve(async (req) => {
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
      console.log(`Unauthorized access attempt by user ${user.id}`);
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

    console.log(`Checking employees with leave quota <= ${threshold} days`);

    // Get employees with low leave quota
    const { data: employees, error } = await supabase
      .rpc('get_low_leave_quota_employees', { threshold });

    if (error) {
      console.error('Error fetching employees:', error);
      throw error;
    }

    console.log(`Found ${employees?.length || 0} employees with low quota`);

    const notifications: { employee: string; success: boolean; remaining: number }[] = [];

    // Send notifications to each employee
    for (const employee of (employees as LowQuotaEmployee[]) || []) {
      const title = '⚠️ Reminder Kuota Cuti';
      const body = `Halo ${employee.full_name}, sisa kuota cuti tahunan Anda tinggal ${employee.remaining_leave} hari. Silakan rencanakan penggunaan cuti Anda dengan bijak.`;
      
      const result = await sendFCMNotification(employee.fcm_token, title, body);
      
      notifications.push({
        employee: employee.full_name,
        success: result !== null,
        remaining: employee.remaining_leave
      });

      console.log(`Notification sent to ${employee.full_name}: ${result ? 'success' : 'failed'}`);
    }

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
  } catch (error: any) {
    console.error('Check leave quota error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});