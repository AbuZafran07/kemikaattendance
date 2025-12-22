import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

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

serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { lat, lng } = await req.json()

    // Validate input
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return new Response(
        JSON.stringify({ error: 'lat and lng must be numbers' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return new Response(
        JSON.stringify({ error: 'Invalid coordinates' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get Mapbox token from secrets
    const mapboxToken = Deno.env.get('MAPBOX_PUBLIC_TOKEN')
    
    if (!mapboxToken) {
      return new Response(
        JSON.stringify({ error: 'Geocoding service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[AUDIT] Reverse geocode requested by authenticated user`)

    // Call Mapbox Geocoding API (server-side, coordinates not exposed to third party from client)
    const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxToken}&types=address,place,locality,neighborhood&limit=1`
    
    const response = await fetch(mapboxUrl)
    
    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: 'Geocoding service unavailable' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const data = await response.json()
    
    let address = 'Alamat tidak ditemukan'
    if (data.features && data.features.length > 0) {
      // Get the place name from Mapbox response
      address = data.features[0].place_name || 'Alamat tidak ditemukan'
      // Shorten to first 3 parts for display
      const parts = address.split(', ')
      if (parts.length > 3) {
        address = parts.slice(0, 3).join(', ')
      }
    }

    return new Response(
      JSON.stringify({ address }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
