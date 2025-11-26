-- Update get_office_location function to return array of office locations
DROP FUNCTION IF EXISTS public.get_office_location();

CREATE OR REPLACE FUNCTION public.get_office_locations()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT value
  FROM system_settings
  WHERE key = 'office_locations';
$$;