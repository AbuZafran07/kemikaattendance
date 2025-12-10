
-- Create a SECURITY DEFINER function to get work hours settings
-- This allows employees to read only the work_hours configuration needed for attendance validation
CREATE OR REPLACE FUNCTION public.get_work_hours()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT value
  FROM system_settings
  WHERE key = 'work_hours';
$$;
