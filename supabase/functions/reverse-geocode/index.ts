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
      console.error('MAPBOX_PUBLIC_TOKEN is not configured')
      return new Response(
        JSON.stringify({ error: 'Geocoding service not configured', address: `Koordinat: ${lat.toFixed(5)}, ${lng.toFixed(5)}` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[AUDIT] Reverse geocode requested by authenticated user for coords: ${lat}, ${lng}`)

    // Call Mapbox Geocoding API - tanpa filter types untuk mendapat hasil lebih banyak
    const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxToken}&limit=5&language=id`
    
    console.log(`Calling Mapbox API: ${mapboxUrl.replace(mapboxToken, 'HIDDEN')}`)
    
    const response = await fetch(mapboxUrl)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Mapbox API error: ${response.status} - ${errorText}`)
      // Coba fallback ke Nominatim (OpenStreetMap)
      try {
        const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=id`
        const nominatimResponse = await fetch(nominatimUrl, {
          headers: { 'User-Agent': 'AttendanceApp/1.0' }
        })
        if (nominatimResponse.ok) {
          const nominatimData = await nominatimResponse.json()
          if (nominatimData.display_name) {
            const parts = nominatimData.display_name.split(', ')
            const address = parts.slice(0, 3).join(', ')
            console.log(`Nominatim fallback address: ${address}`)
            return new Response(
              JSON.stringify({ address }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        }
      } catch (fallbackError) {
        console.error('Nominatim fallback also failed:', fallbackError)
      }
      
      return new Response(
        JSON.stringify({ address: `Lokasi: ${lat.toFixed(6)}, ${lng.toFixed(6)}` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const data = await response.json()
    console.log(`Mapbox response features count: ${data.features?.length || 0}`)
    
    let address = ''
    if (data.features && data.features.length > 0) {
      // Cari feature yang paling spesifik (address > poi > place > locality > neighborhood)
      const feature = data.features[0]
      address = feature.place_name || ''
      
      // Log semua features untuk debugging
      console.log(`Mapbox features:`, JSON.stringify(data.features.map((f: { id: string; place_name: string }) => ({ id: f.id, place_name: f.place_name }))))
      
      // Shorten to first 3-4 parts for display
      if (address) {
        const parts = address.split(', ')
        if (parts.length > 4) {
          address = parts.slice(0, 4).join(', ')
        }
      }
      console.log(`Resolved address: ${address}`)
    }
    
    // Jika Mapbox tidak mengembalikan alamat, coba Nominatim
    if (!address) {
      console.log('Mapbox returned no results, trying Nominatim fallback...')
      try {
        const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=id`
        const nominatimResponse = await fetch(nominatimUrl, {
          headers: { 'User-Agent': 'AttendanceApp/1.0' }
        })
        if (nominatimResponse.ok) {
          const nominatimData = await nominatimResponse.json()
          if (nominatimData.display_name) {
            const parts = nominatimData.display_name.split(', ')
            address = parts.slice(0, 3).join(', ')
            console.log(`Nominatim fallback address: ${address}`)
          }
        }
      } catch (fallbackError) {
        console.error('Nominatim fallback failed:', fallbackError)
      }
    }
    
    // Final fallback jika semua gagal
    if (!address) {
      address = `Lokasi: ${lat.toFixed(6)}, ${lng.toFixed(6)}`
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
