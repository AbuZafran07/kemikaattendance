
CREATE OR REPLACE FUNCTION public.get_bpjs_config()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT value
  FROM public.system_settings
  WHERE key = 'bpjs_config';
$$;
