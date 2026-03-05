
CREATE OR REPLACE FUNCTION public.get_ptkp_config()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $$
  SELECT value
  FROM public.system_settings
  WHERE key = 'ptkp_config';
$$;
