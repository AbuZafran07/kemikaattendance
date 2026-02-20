
-- Fix 1: Update all SECURITY DEFINER functions to use empty search_path
-- This prevents potential search_path manipulation attacks

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, nik, full_name, email, jabatan, departemen)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nik', 'NIK' || substring(NEW.id::text from 1 for 8)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'jabatan', 'Employee'),
    COALESCE(NEW.raw_user_meta_data->>'departemen', 'General')
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'employee');
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.deduct_leave_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status = 'pending' AND NEW.leave_type = 'cuti_tahunan' THEN
    UPDATE public.profiles
    SET remaining_leave = remaining_leave - NEW.total_days
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_work_hours()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT value
  FROM public.system_settings
  WHERE key = 'work_hours';
$$;

CREATE OR REPLACE FUNCTION public.get_office_locations()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT value
  FROM public.system_settings
  WHERE key = 'office_locations';
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
BEGIN
  SELECT value INTO normal_settings
  FROM public.system_settings
  WHERE key = 'work_hours';
  
  SELECT value INTO special_settings
  FROM public.system_settings
  WHERE key = 'special_work_hours';
  
  IF special_settings IS NULL THEN
    RETURN COALESCE(normal_settings, '{}'::jsonb);
  END IF;
  
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
  
  RETURN COALESCE(normal_settings, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_leave_request(request_id uuid, notes text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  approver_id UUID;
  request_status TEXT;
BEGIN
  approver_id := auth.uid();
  IF approver_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT public.has_role(approver_id, 'admin'::public.app_role) THEN RAISE EXCEPTION 'Only admins can approve requests'; END IF;
  IF notes IS NOT NULL AND length(notes) > 1000 THEN RAISE EXCEPTION 'Notes must be 1000 characters or less'; END IF;
  
  SELECT l.status INTO request_status FROM public.leave_requests l WHERE l.id = request_id;
  IF request_status IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF request_status != 'pending' THEN RAISE EXCEPTION 'Only pending requests can be approved'; END IF;
  
  UPDATE public.leave_requests SET
    status = 'approved', approved_by = approver_id, approved_at = NOW(),
    approval_notes = notes, updated_at = NOW()
  WHERE id = request_id AND status = 'pending';
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

CREATE OR REPLACE FUNCTION public.approve_overtime_request(request_id uuid, notes text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  approver_id UUID;
  request_status TEXT;
BEGIN
  approver_id := auth.uid();
  IF approver_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT public.has_role(approver_id, 'admin'::public.app_role) THEN RAISE EXCEPTION 'Only admins can approve requests'; END IF;
  IF notes IS NOT NULL AND length(notes) > 1000 THEN RAISE EXCEPTION 'Notes must be 1000 characters or less'; END IF;
  
  SELECT o.status INTO request_status FROM public.overtime_requests o WHERE o.id = request_id;
  IF request_status IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF request_status != 'pending' THEN RAISE EXCEPTION 'Only pending requests can be approved'; END IF;
  
  UPDATE public.overtime_requests SET
    status = 'approved', approved_by = approver_id, approved_at = NOW(),
    approval_notes = notes, updated_at = NOW()
  WHERE id = request_id AND status = 'pending';
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_overtime_request(request_id uuid, reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  rejector_id UUID;
  request_status TEXT;
BEGIN
  rejector_id := auth.uid();
  IF rejector_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT public.has_role(rejector_id, 'admin'::public.app_role) THEN RAISE EXCEPTION 'Only admins can reject requests'; END IF;
  IF reason IS NULL OR length(trim(reason)) = 0 THEN RAISE EXCEPTION 'Rejection reason is required'; END IF;
  IF length(reason) > 1000 THEN RAISE EXCEPTION 'Rejection reason must be 1000 characters or less'; END IF;
  
  SELECT o.status INTO request_status FROM public.overtime_requests o WHERE o.id = request_id;
  IF request_status IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF request_status != 'pending' THEN RAISE EXCEPTION 'Only pending requests can be rejected'; END IF;
  
  UPDATE public.overtime_requests SET
    status = 'rejected', rejection_reason = reason, updated_at = NOW()
  WHERE id = request_id AND status = 'pending';
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_business_travel_request(request_id uuid, document_url_param text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  approver_id UUID;
  request_status TEXT;
BEGIN
  approver_id := auth.uid();
  IF approver_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT public.has_role(approver_id, 'admin'::public.app_role) THEN RAISE EXCEPTION 'Only admins can approve requests'; END IF;
  
  SELECT b.status INTO request_status FROM public.business_travel_requests b WHERE b.id = request_id;
  IF request_status IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF request_status != 'pending' THEN RAISE EXCEPTION 'Only pending requests can be approved'; END IF;
  
  UPDATE public.business_travel_requests SET
    status = 'approved', approved_by = approver_id, approved_at = NOW(),
    document_url = COALESCE(document_url_param, document_url), updated_at = NOW()
  WHERE id = request_id AND status = 'pending';
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_business_travel_request(request_id uuid, reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  rejector_id UUID;
  request_status TEXT;
BEGIN
  rejector_id := auth.uid();
  IF rejector_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT public.has_role(rejector_id, 'admin'::public.app_role) THEN RAISE EXCEPTION 'Only admins can reject requests'; END IF;
  IF reason IS NULL OR length(trim(reason)) = 0 THEN RAISE EXCEPTION 'Rejection reason is required'; END IF;
  IF length(reason) > 1000 THEN RAISE EXCEPTION 'Rejection reason must be 1000 characters or less'; END IF;
  
  SELECT b.status INTO request_status FROM public.business_travel_requests b WHERE b.id = request_id;
  IF request_status IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF request_status != 'pending' THEN RAISE EXCEPTION 'Only pending requests can be rejected'; END IF;
  
  UPDATE public.business_travel_requests SET
    status = 'rejected', rejection_reason = reason, updated_at = NOW()
  WHERE id = request_id AND status = 'pending';
END;
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

-- Fix 2: Restrict business-travel-docs storage access to owner + admins
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view business travel documents" ON storage.objects;

-- Admins can view all travel documents
CREATE POLICY "Admins can view all travel documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'business-travel-docs' AND
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Users can view documents for their own travel requests
CREATE POLICY "Users can view their own travel documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'business-travel-docs' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
