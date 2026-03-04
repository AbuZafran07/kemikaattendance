
-- Fix SECURITY DEFINER functions to use empty search_path (SET search_path = '')
-- These were reintroduced with 'public' search_path in later migrations

CREATE OR REPLACE FUNCTION public.get_office_locations()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT value
  FROM public.system_settings
  WHERE key = 'office_locations';
$$;

CREATE OR REPLACE FUNCTION public.get_low_leave_quota_employees(threshold integer DEFAULT 3)
RETURNS TABLE(user_id uuid, full_name text, remaining_leave integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  
  RETURN QUERY
  SELECT p.id as user_id, p.full_name, p.remaining_leave
  FROM public.profiles p
  WHERE p.remaining_leave IS NOT NULL 
    AND p.remaining_leave <= threshold
    AND p.remaining_leave > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_effective_work_hours()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  special_settings jsonb;
  normal_settings jsonb;
  periods jsonb;
  period jsonb;
  today date := CURRENT_DATE;
  today_dow int := EXTRACT(DOW FROM CURRENT_DATE)::int;
  result jsonb;
BEGIN
  SELECT value INTO normal_settings
  FROM public.system_settings
  WHERE key = 'work_hours';
  
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
$$;

CREATE OR REPLACE FUNCTION public.reject_leave_request(request_id uuid, reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  rejector_id UUID;
  request_status TEXT;
  rejection_reason_param ALIAS FOR reason;
BEGIN
  rejector_id := auth.uid();
  IF rejector_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT public.has_role(rejector_id, 'admin'::public.app_role) THEN RAISE EXCEPTION 'Only admins can reject requests'; END IF;
  IF rejection_reason_param IS NULL OR length(trim(rejection_reason_param)) = 0 THEN RAISE EXCEPTION 'Rejection reason is required'; END IF;
  IF length(rejection_reason_param) > 1000 THEN RAISE EXCEPTION 'Rejection reason must be 1000 characters or less'; END IF;
  
  SELECT l.status INTO request_status FROM public.leave_requests l WHERE l.id = request_id;
  IF request_status IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF request_status != 'pending' THEN RAISE EXCEPTION 'Only pending requests can be rejected'; END IF;
  
  UPDATE public.leave_requests l SET
    status = 'rejected', rejection_reason = rejection_reason_param, updated_at = NOW()
  WHERE l.id = request_id AND l.status = 'pending';
END;
$$;
