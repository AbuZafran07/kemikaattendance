import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FIREBASE_SERVER_KEY = Deno.env.get('FIREBASE_SERVER_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify the requesting user is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError?.message);
      return new Response(JSON.stringify({ error: 'Invalid token' }), { 
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if user has admin role
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || roleData?.role !== 'admin') {
      console.error('Admin check failed:', roleError?.message || 'User is not admin');
      return new Response(JSON.stringify({ error: 'Only admins can send notifications' }), { 
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Admin verified, processing notification request');

    const { fcmToken, title, body, data } = await req.json();

    // Input validation
    if (!fcmToken || typeof fcmToken !== 'string' || fcmToken.length > 300) {
      throw new Error('Invalid FCM token: must be a non-empty string with max 300 characters');
    }
    if (!title || typeof title !== 'string' || title.length > 100) {
      throw new Error('Invalid title: must be a non-empty string with max 100 characters');
    }
    if (!body || typeof body !== 'string' || body.length > 500) {
      throw new Error('Invalid body: must be a non-empty string with max 500 characters');
    }
    if (data !== undefined && (typeof data !== 'object' || data === null || Array.isArray(data))) {
      throw new Error('Invalid data: must be an object if provided');
    }

    if (!FIREBASE_SERVER_KEY) {
      throw new Error('Firebase server key not configured');
    }

    // Send FCM notification
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
        data: data || {}
      })
    });

    const result = await response.json();
    
    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Send notification error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
