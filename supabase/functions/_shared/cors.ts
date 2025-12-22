// Allowed origins for CORS - update this list with your production domains
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8080',
  'https://lovable.dev',
  'https://preview--psaqqtfitxevwkgzupnp.lovable.app',
  'https://psaqqtfitxevwkgzupnp.lovable.app',
];

// Check if origin should be allowed
export function getAllowedOrigin(requestOrigin: string | null): string {
  // Allow exact matches
  if (requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)) {
    return requestOrigin;
  }
  
  // Allow any lovable.app subdomain
  if (requestOrigin && requestOrigin.match(/^https:\/\/[a-z0-9-]+\.lovable\.app$/)) {
    return requestOrigin;
  }
  
  // Default: deny (return empty string so CORS will fail)
  return '';
}

export function getCorsHeaders(requestOrigin: string | null) {
  const allowedOrigin = getAllowedOrigin(requestOrigin);
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
