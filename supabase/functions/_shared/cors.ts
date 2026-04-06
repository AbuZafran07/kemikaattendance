// Environment-based CORS configuration for security
// Localhost origins are only allowed in development mode

// Check if running in development mode
function isDevelopment(): boolean {
  return Deno.env.get('ENVIRONMENT') !== 'production';
}

// Localhost origins only allowed in development
const DEVELOPMENT_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8080',
];

// Check if origin should be allowed
export function getAllowedOrigin(requestOrigin: string | null): string {
  if (!requestOrigin) {
    return '';
  }

  // Allow any secure production origin, including custom company domains
  if (requestOrigin.startsWith('https://')) {
    return requestOrigin;
  }
  
  // Only allow localhost origins in development mode
  if (isDevelopment() && DEVELOPMENT_ORIGINS.includes(requestOrigin)) {
    return requestOrigin;
  }
  
  // Default: deny (return empty string so CORS will fail)
  return '';
}

export function getCorsHeaders(requestOrigin: string | null) {
  const allowedOrigin = getAllowedOrigin(requestOrigin);
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };
}

export function handleCorsPreflightRequest(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('Origin');
    return new Response(null, { headers: getCorsHeaders(origin) });
  }
  return null;
}
