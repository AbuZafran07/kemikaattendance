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

// Round coordinates to 4 decimal places (~11 meters precision) for cache key
function roundCoord(coord: number, decimals: number = 4): number {
  return Math.round(coord * Math.pow(10, decimals)) / Math.pow(10, decimals);
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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // User client for auth verification
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Service client for cache operations
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey)

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

    // Round coordinates for cache lookup (~11 meters precision)
    const latRounded = roundCoord(lat)
    const lngRounded = roundCoord(lng)

    console.log(`[GEOCODE] Request for coords: ${lat}, ${lng} (rounded: ${latRounded}, ${lngRounded})`)

    // Check cache first
    const { data: cached, error: cacheError } = await supabaseService
      .from('geocoding_cache')
      .select('address, id, hit_count')
      .eq('lat_rounded', latRounded)
      .eq('lng_rounded', lngRounded)
      .single()

    if (cached && !cacheError) {
      console.log(`[GEOCODE] Cache HIT - returning cached address: ${cached.address}`)
      
      // Update hit count and last_used_at asynchronously (fire and forget)
      supabaseService
        .from('geocoding_cache')
        .update({ 
          hit_count: cached.hit_count + 1, 
          last_used_at: new Date().toISOString() 
        })
        .eq('id', cached.id)
        .then(() => console.log('[GEOCODE] Cache stats updated'))

      return new Response(
        JSON.stringify({ address: cached.address, cached: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('[GEOCODE] Cache MISS - calling external API')

    // Get Mapbox token from secrets
    const mapboxToken = Deno.env.get('MAPBOX_PUBLIC_TOKEN')
    
    let address = ''
    let streetAddress = ''

    // Try Mapbox first if token is available
    if (mapboxToken && mapboxToken.trim() !== '') {
      // Use types=address,poi to prioritize street-level results
      const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxToken}&types=address,poi,place,locality,neighborhood&limit=5&language=id`
      
      console.log('[GEOCODE] Calling Mapbox API with street-level types...')
      
      try {
        const response = await fetch(mapboxUrl)
        
        if (response.ok) {
          const data = await response.json()
          console.log(`[GEOCODE] Mapbox response features count: ${data.features?.length || 0}`)
          
          if (data.features && data.features.length > 0) {
            // Try to find the most specific address (street-level first)
            const addressFeature = data.features.find((f: any) => f.place_type?.includes('address'))
            const poiFeature = data.features.find((f: any) => f.place_type?.includes('poi'))
            const bestFeature = addressFeature || poiFeature || data.features[0]
            
            // Get the full place name
            const fullAddress = bestFeature.place_name || ''
            
            // Extract street name from properties if available
            if (bestFeature.properties?.address) {
              streetAddress = bestFeature.properties.address
            } else if (bestFeature.text) {
              streetAddress = bestFeature.text
            }
            
            // Build a meaningful address
            if (fullAddress) {
              const parts = fullAddress.split(', ')
              // Take first 4 parts for a readable address
              address = parts.slice(0, 4).join(', ')
              
              // If we have a street address, prepend it for clarity
              if (streetAddress && !address.toLowerCase().includes(streetAddress.toLowerCase())) {
                address = `${streetAddress}, ${parts.slice(1, 4).join(', ')}`
              }
            }
            
            console.log(`[GEOCODE] Mapbox resolved address: ${address}`)
            console.log(`[GEOCODE] Street address extracted: ${streetAddress}`)
          }
        } else {
          const errorText = await response.text()
          console.error(`[GEOCODE] Mapbox API error: ${response.status} - ${errorText}`)
        }
      } catch (mapboxError) {
        console.error('[GEOCODE] Mapbox fetch error:', mapboxError)
      }
    } else {
      console.warn('[GEOCODE] MAPBOX_PUBLIC_TOKEN not configured or empty')
    }

    // Fallback to Nominatim (OpenStreetMap) if Mapbox failed
    if (!address) {
      console.log('[GEOCODE] Trying Nominatim fallback...')
      try {
        const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=id`
        const nominatimResponse = await fetch(nominatimUrl, {
          headers: { 'User-Agent': 'AttendanceApp/1.0' }
        })
        if (nominatimResponse.ok) {
          const nominatimData = await nominatimResponse.json()
          console.log(`[GEOCODE] Nominatim raw response:`, JSON.stringify(nominatimData.address || {}))
          
          if (nominatimData.address) {
            // Build street-level address from address components
            const addr = nominatimData.address
            const streetParts = []
            
            // Add street name or road
            if (addr.road) streetParts.push(addr.road)
            else if (addr.pedestrian) streetParts.push(addr.pedestrian)
            else if (addr.footway) streetParts.push(addr.footway)
            
            // Add house number if available
            if (addr.house_number && streetParts.length > 0) {
              streetParts[0] = `${streetParts[0]} No. ${addr.house_number}`
            }
            
            // Add neighborhood/village
            if (addr.neighbourhood) streetParts.push(addr.neighbourhood)
            else if (addr.village) streetParts.push(addr.village)
            else if (addr.suburb) streetParts.push(addr.suburb)
            
            // Add subdistrict/city
            if (addr.city_district) streetParts.push(addr.city_district)
            else if (addr.city) streetParts.push(addr.city)
            else if (addr.town) streetParts.push(addr.town)
            
            if (streetParts.length > 0) {
              address = streetParts.slice(0, 4).join(', ')
              console.log(`[GEOCODE] Nominatim built address: ${address}`)
            } else if (nominatimData.display_name) {
              // Fallback to display_name
              const parts = nominatimData.display_name.split(', ')
              address = parts.slice(0, 4).join(', ')
              console.log(`[GEOCODE] Nominatim display_name address: ${address}`)
            }
          } else if (nominatimData.display_name) {
            const parts = nominatimData.display_name.split(', ')
            address = parts.slice(0, 4).join(', ')
            console.log(`[GEOCODE] Nominatim resolved address: ${address}`)
          }
        } else {
          console.error(`[GEOCODE] Nominatim error: ${nominatimResponse.status}`)
        }
      } catch (nominatimError) {
        console.error('[GEOCODE] Nominatim fallback error:', nominatimError)
      }
    }

    // Final fallback if all APIs failed
    if (!address) {
      address = `Lokasi: ${lat.toFixed(6)}, ${lng.toFixed(6)}`
      console.log('[GEOCODE] All APIs failed, using coordinate fallback')
    }

    // Store in cache (only if we got a real address, not coordinates)
    if (!address.startsWith('Lokasi:')) {
      const { error: insertError } = await supabaseService
        .from('geocoding_cache')
        .upsert({
          lat_rounded: latRounded,
          lng_rounded: lngRounded,
          address: address,
          last_used_at: new Date().toISOString()
        }, {
          onConflict: 'lat_rounded,lng_rounded'
        })

      if (insertError) {
        console.error('[GEOCODE] Failed to cache result:', insertError)
      } else {
        console.log('[GEOCODE] Result cached successfully')
      }
    }

    return new Response(
      JSON.stringify({ address, cached: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[GEOCODE] Unexpected error:', message)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})