import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FIREBASE_SERVER_KEY = Deno.env.get('FIREBASE_SERVER_KEY');

Deno.serve(async (req) => {
  try {
    const { fcmToken, title, body, data } = await req.json();

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
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
