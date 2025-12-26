-- Add explicit deny policy for regular authenticated users on geocoding_cache
-- This ensures only the service role can access this table

-- First, drop any existing conflicting policies if they exist
DROP POLICY IF EXISTS "Deny authenticated user access to geocoding_cache" ON public.geocoding_cache;

-- Create explicit deny policy for all authenticated users (except service role)
-- This is a RESTRICTIVE policy that blocks all operations for regular users
CREATE POLICY "Deny authenticated user access to geocoding_cache"
ON public.geocoding_cache
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- Add comment explaining the security model
COMMENT ON TABLE public.geocoding_cache IS 'Geocoding cache table - accessible only via service role through reverse-geocode Edge Function. Direct user access is denied for security.';