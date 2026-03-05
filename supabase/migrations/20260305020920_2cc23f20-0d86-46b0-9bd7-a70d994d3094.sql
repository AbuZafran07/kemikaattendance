
CREATE OR REPLACE FUNCTION public.get_pph21_brackets_config()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $$
  SELECT value
  FROM public.system_settings
  WHERE key = 'pph21_brackets_config';
$$;
