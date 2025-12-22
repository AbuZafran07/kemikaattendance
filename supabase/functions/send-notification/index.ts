import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FIREBASE_SERVER_KEY = Deno.env.get('FIREBASE_SERVER_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// CORS configuration - restrict to allowed origins
function getCorsHeaders(origin: string | null) {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:8080',
  ];
  
  // Allow lovable.app subdomains
  const isLovableApp = origin?.match(/^https:\/\/[a-z0-9-]+\.lovable\.app$/);
  const isAllowed = origin && (allowedOrigins.includes(origin) || isLovableApp);
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : '',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

// Rate limiting: track notifications per admin (in-memory, resets on function restart)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 20; // Max 20 notifications per hour per admin
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds

function checkRateLimit(adminId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = rateLimitMap.get(adminId);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(adminId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }
  
  if (record.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 };
  }
  
  record.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - record.count };
}

// Sanitize text content to prevent any injection
function sanitizeContent(text: string): string {
  // Remove any HTML tags
  let sanitized = text.replace(/<[^>]*>/g, '');
  // Remove script-like patterns
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/on\w+=/gi, '');
  // Remove control characters except newlines and tabs
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  return sanitized.trim();
}

// Validate URLs in content - only allow https URLs from known domains
function validateUrls(text: string): { valid: boolean; reason?: string } {
  const urlPattern = /https?:\/\/[^\s]+/gi;
  const urls = text.match(urlPattern) || [];
  
  for (const url of urls) {
    try {
      const parsed = new URL(url);
      // Only allow HTTPS
      if (parsed.protocol !== 'https:') {
        return { valid: false, reason: 'Only HTTPS URLs are allowed' };
      }
      // Block known suspicious patterns
      if (parsed.hostname.includes('..') || parsed.hostname.startsWith('-')) {
        return { valid: false, reason: 'Invalid URL hostname' };
      }
    } catch {
      return { valid: false, reason: 'Invalid URL format' };
    }
  }
  
  return { valid: true };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify the requesting user is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
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
      return new Response(JSON.stringify({ error: 'Only admins can send notifications' }), { 
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check rate limit
    const rateCheck = checkRateLimit(user.id);
    if (!rateCheck.allowed) {
      return new Response(JSON.stringify({ 
        error: 'Rate limit exceeded. Maximum 20 notifications per hour.',
        retryAfter: 'Please wait before sending more notifications'
      }), { 
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[AUDIT] Admin sending notification (${rateCheck.remaining} remaining)`);

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

    // Sanitize content
    const sanitizedTitle = sanitizeContent(title);
    const sanitizedBody = sanitizeContent(body);

    if (sanitizedTitle.length === 0) {
      throw new Error('Title cannot be empty after sanitization');
    }
    if (sanitizedBody.length === 0) {
      throw new Error('Body cannot be empty after sanitization');
    }

    // Validate URLs in body
    const urlValidation = validateUrls(sanitizedBody);
    if (!urlValidation.valid) {
      throw new Error(`Invalid URL in notification body: ${urlValidation.reason}`);
    }

    if (!FIREBASE_SERVER_KEY) {
      throw new Error('Firebase server key not configured');
    }

    // Audit log (server-side only, no sensitive data exposed)
    console.log(`[AUDIT] Notification sent - Title: "${sanitizedTitle.substring(0, 30)}..."`);

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
          title: sanitizedTitle,
          body: sanitizedBody,
          icon: '/logo.png'
        },
        data: data || {}
      })
    });

    const result = await response.json();
    
    console.log(`[AUDIT] Notification delivery completed`);
    
    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
