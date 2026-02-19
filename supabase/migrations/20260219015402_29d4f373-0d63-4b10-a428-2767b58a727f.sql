
-- Create an RPC function that returns the effective work hours for today,
-- considering any active special work hours periods (Ramadhan, etc.)
CREATE OR REPLACE FUNCTION public.get_effective_work_hours()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  special_settings jsonb;
  normal_settings jsonb;
  periods jsonb;
  period jsonb;
  today date := CURRENT_DATE;
BEGIN
  -- Get normal work hours
  SELECT value INTO normal_settings
  FROM system_settings
  WHERE key = 'work_hours';
  
  -- Get special work hours settings
  SELECT value INTO special_settings
  FROM system_settings
  WHERE key = 'special_work_hours';
  
  -- If no special settings, return normal
  IF special_settings IS NULL THEN
    RETURN COALESCE(normal_settings, '{}'::jsonb);
  END IF;
  
  -- Check if any active special period covers today
  periods := COALESCE(special_settings->'periods', '[]'::jsonb);
  
  FOR period IN SELECT * FROM jsonb_array_elements(periods)
  LOOP
    IF (period->>'is_active')::boolean = true
       AND today >= (period->>'start_date')::date
       AND today <= (period->>'end_date')::date
    THEN
      -- Return the special work hours for this period
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
  
  -- No active special period for today, return normal
  RETURN COALESCE(normal_settings, '{}'::jsonb);
END;
$function$;
