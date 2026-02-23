
CREATE OR REPLACE FUNCTION public.get_effective_work_hours()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  special_settings jsonb;
  normal_settings jsonb;
  periods jsonb;
  period jsonb;
  today date := CURRENT_DATE;
  today_dow int := EXTRACT(DOW FROM CURRENT_DATE)::int; -- 0=Sunday, 5=Friday
  result jsonb;
BEGIN
  SELECT value INTO normal_settings
  FROM public.system_settings
  WHERE key = 'work_hours';
  
  -- Check special work hours first (highest priority)
  SELECT value INTO special_settings
  FROM public.system_settings
  WHERE key = 'special_work_hours';
  
  IF special_settings IS NOT NULL THEN
    periods := COALESCE(special_settings->'periods', '[]'::jsonb);
    
    FOR period IN SELECT * FROM jsonb_array_elements(periods)
    LOOP
      IF (period->>'is_active')::boolean = true
         AND today >= (period->>'start_date')::date
         AND today <= (period->>'end_date')::date
      THEN
        RETURN jsonb_build_object(
          'check_in_start', COALESCE(period->>'check_in_start', normal_settings->>'check_in_start'),
          'check_in_end', period->>'check_in_end',
          'check_out_start', period->>'check_out_start',
          'check_out_end', COALESCE(period->>'check_out_end', normal_settings->>'check_out_end'),
          'late_tolerance_minutes', COALESCE((period->>'late_tolerance_minutes')::int, (normal_settings->>'late_tolerance_minutes')::int),
          'early_leave_tolerance_minutes', COALESCE((period->>'early_leave_tolerance_minutes')::int, (normal_settings->>'early_leave_tolerance_minutes')::int),
          'special_period_name', period->>'name'
        );
      END IF;
    END LOOP;
  END IF;
  
  result := COALESCE(normal_settings, '{}'::jsonb);
  
  -- Apply Friday overrides if enabled (second priority)
  IF today_dow = 5 AND (result->>'friday_enabled')::boolean = true THEN
    result := jsonb_build_object(
      'check_in_start', result->>'check_in_start',
      'check_in_end', result->>'check_in_end',
      'check_out_start', COALESCE(result->>'friday_check_out_start', result->>'check_out_start'),
      'check_out_end', COALESCE(result->>'friday_check_out_end', result->>'check_out_end'),
      'late_tolerance_minutes', COALESCE((result->>'late_tolerance_minutes')::int, 15),
      'early_leave_tolerance_minutes', COALESCE((result->>'friday_early_leave_tolerance_minutes')::int, (result->>'early_leave_tolerance_minutes')::int),
      'is_friday_schedule', true
    );
  END IF;
  
  RETURN result;
END;
$function$;
