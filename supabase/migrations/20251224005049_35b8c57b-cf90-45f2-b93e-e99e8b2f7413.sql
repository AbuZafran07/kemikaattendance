-- Drop the overly permissive policy that allows any authenticated user to read all cached addresses
DROP POLICY IF EXISTS "Authenticated users can read geocoding cache" ON geocoding_cache;

-- The cache should only be accessed by the service role (edge function)
-- No user-facing access is needed since the edge function handles geocoding
-- The "Service role can manage geocoding cache" policy already exists and handles all operations for the edge function