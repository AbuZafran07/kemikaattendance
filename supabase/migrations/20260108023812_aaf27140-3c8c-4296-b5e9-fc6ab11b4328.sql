-- Fix: Deny anonymous access to geocoding_cache table
-- Currently only authenticated users are blocked, but anonymous users can read the data

-- Add policy to deny anonymous access
CREATE POLICY "Deny anonymous access to geocoding_cache"
ON public.geocoding_cache
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);