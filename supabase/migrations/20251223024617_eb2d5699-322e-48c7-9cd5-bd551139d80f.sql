-- Create geocoding cache table
CREATE TABLE public.geocoding_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lat_rounded DECIMAL(7,4) NOT NULL,
  lng_rounded DECIMAL(7,4) NOT NULL,
  address TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  hit_count INTEGER NOT NULL DEFAULT 1,
  last_used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(lat_rounded, lng_rounded)
);

-- Enable RLS
ALTER TABLE public.geocoding_cache ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read cache
CREATE POLICY "Authenticated users can read geocoding cache"
ON public.geocoding_cache
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to insert cache (via edge function with service role)
CREATE POLICY "Service role can manage geocoding cache"
ON public.geocoding_cache
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for fast lookups
CREATE INDEX idx_geocoding_cache_coords ON public.geocoding_cache (lat_rounded, lng_rounded);

-- Create index for cleanup (oldest entries)
CREATE INDEX idx_geocoding_cache_last_used ON public.geocoding_cache (last_used_at);

-- Comment for documentation
COMMENT ON TABLE public.geocoding_cache IS 'Cache for reverse geocoding results to reduce API calls';