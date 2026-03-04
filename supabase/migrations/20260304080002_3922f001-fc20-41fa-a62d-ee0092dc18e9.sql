CREATE OR REPLACE FUNCTION public.approve_leave_request(request_id uuid, notes text DEFAULT NULL::text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  approver_id UUID;
  request_status TEXT;
BEGIN
  approver_id := auth.uid();
  IF approver_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT public.has_role(approver_id, 'admin'::public.app_role) THEN RAISE EXCEPTION 'Only admins can approve requests'; END IF;
  IF request_id IS NULL THEN RAISE EXCEPTION 'request_id is required'; END IF;
  IF notes IS NOT NULL THEN
    IF length(notes) > 1000 THEN RAISE EXCEPTION 'Notes must be 1000 characters or less'; END IF;
    notes := regexp_replace(notes, E'[\\x00-\\x1F\\x7F]', '', 'g');
  END IF;
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
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  rejector_id UUID;
  request_status TEXT;
  rejection_reason_param ALIAS FOR reason;
BEGIN
  rejector_id := auth.uid();
  IF rejector_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT public.has_role(rejector_id, 'admin'::public.app_role) THEN RAISE EXCEPTION 'Only admins can reject requests'; END IF;
  IF request_id IS NULL THEN RAISE EXCEPTION 'request_id is required'; END IF;
  IF rejection_reason_param IS NULL OR length(trim(rejection_reason_param)) = 0 THEN RAISE EXCEPTION 'Rejection reason is required'; END IF;
  IF length(rejection_reason_param) > 1000 THEN RAISE EXCEPTION 'Rejection reason must be 1000 characters or less'; END IF;
  rejection_reason_param := regexp_replace(rejection_reason_param, E'[\\x00-\\x1F\\x7F]', '', 'g');
  SELECT l.status INTO request_status FROM public.leave_requests l WHERE l.id = request_id;
  IF request_status IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF request_status != 'pending' THEN RAISE EXCEPTION 'Only pending requests can be rejected'; END IF;
  UPDATE public.leave_requests l SET
    status = 'rejected', rejection_reason = rejection_reason_param, updated_at = NOW()
  WHERE l.id = request_id AND l.status = 'pending';
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_overtime_request(request_id uuid, notes text DEFAULT NULL::text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  approver_id UUID;
  request_status TEXT;
BEGIN
  approver_id := auth.uid();
  IF approver_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT public.has_role(approver_id, 'admin'::public.app_role) THEN RAISE EXCEPTION 'Only admins can approve requests'; END IF;
  IF request_id IS NULL THEN RAISE EXCEPTION 'request_id is required'; END IF;
  IF notes IS NOT NULL THEN
    IF length(notes) > 1000 THEN RAISE EXCEPTION 'Notes must be 1000 characters or less'; END IF;
    notes := regexp_replace(notes, E'[\\x00-\\x1F\\x7F]', '', 'g');
  END IF;
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
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  rejector_id UUID;
  request_status TEXT;
BEGIN
  rejector_id := auth.uid();
  IF rejector_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT public.has_role(rejector_id, 'admin'::public.app_role) THEN RAISE EXCEPTION 'Only admins can reject requests'; END IF;
  IF request_id IS NULL THEN RAISE EXCEPTION 'request_id is required'; END IF;
  IF reason IS NULL OR length(trim(reason)) = 0 THEN RAISE EXCEPTION 'Rejection reason is required'; END IF;
  IF length(reason) > 1000 THEN RAISE EXCEPTION 'Rejection reason must be 1000 characters or less'; END IF;
  reason := regexp_replace(reason, E'[\\x00-\\x1F\\x7F]', '', 'g');
  SELECT o.status INTO request_status FROM public.overtime_requests o WHERE o.id = request_id;
  IF request_status IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF request_status != 'pending' THEN RAISE EXCEPTION 'Only pending requests can be rejected'; END IF;
  UPDATE public.overtime_requests SET
    status = 'rejected', rejection_reason = reason, updated_at = NOW()
  WHERE id = request_id AND status = 'pending';
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_business_travel_request(request_id uuid, document_url_param text DEFAULT NULL::text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  approver_id UUID;
  request_status TEXT;
BEGIN
  approver_id := auth.uid();
  IF approver_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT public.has_role(approver_id, 'admin'::public.app_role) THEN RAISE EXCEPTION 'Only admins can approve requests'; END IF;
  IF request_id IS NULL THEN RAISE EXCEPTION 'request_id is required'; END IF;
  IF document_url_param IS NOT NULL THEN
    document_url_param := regexp_replace(document_url_param, E'[\\x00-\\x1F\\x7F]', '', 'g');
  END IF;
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
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  rejector_id UUID;
  request_status TEXT;
BEGIN
  rejector_id := auth.uid();
  IF rejector_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT public.has_role(rejector_id, 'admin'::public.app_role) THEN RAISE EXCEPTION 'Only admins can reject requests'; END IF;
  IF request_id IS NULL THEN RAISE EXCEPTION 'request_id is required'; END IF;
  IF reason IS NULL OR length(trim(reason)) = 0 THEN RAISE EXCEPTION 'Rejection reason is required'; END IF;
  IF length(reason) > 1000 THEN RAISE EXCEPTION 'Rejection reason must be 1000 characters or less'; END IF;
  reason := regexp_replace(reason, E'[\\x00-\\x1F\\x7F]', '', 'g');
  SELECT b.status INTO request_status FROM public.business_travel_requests b WHERE b.id = request_id;
  IF request_status IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF request_status != 'pending' THEN RAISE EXCEPTION 'Only pending requests can be rejected'; END IF;
  UPDATE public.business_travel_requests SET
    status = 'rejected', rejection_reason = reason, updated_at = NOW()
  WHERE id = request_id AND status = 'pending';
END;
$$;