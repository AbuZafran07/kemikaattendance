-- Fix search path for get_office_locations function
CREATE OR REPLACE FUNCTION public.get_office_locations()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT value
  FROM system_settings
  WHERE key = 'office_locations';
$$;