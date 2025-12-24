-- Create secure functions for leave request approval/rejection
-- These functions validate admin access and input on the server side

-- Approve leave request function
CREATE OR REPLACE FUNCTION public.approve_leave_request(
  request_id UUID,
  notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  approver_id UUID;
  request_status TEXT;
BEGIN
  -- Get current user ID
  approver_id := auth.uid();
  
  -- Verify caller is authenticated
  IF approver_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Verify caller is an admin
  IF NOT has_role(approver_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can approve requests';
  END IF;
  
  -- Validate notes length (max 1000 characters)
  IF notes IS NOT NULL AND length(notes) > 1000 THEN
    RAISE EXCEPTION 'Notes must be 1000 characters or less';
  END IF;
  
  -- Check if request exists and is pending
  SELECT status INTO request_status
  FROM leave_requests
  WHERE id = request_id;
  
  IF request_status IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  
  IF request_status != 'pending' THEN
    RAISE EXCEPTION 'Only pending requests can be approved';
  END IF;
  
  -- Update the request
  UPDATE leave_requests SET
    status = 'approved',
    approved_by = approver_id,
    approved_at = NOW(),
    approval_notes = notes,
    updated_at = NOW()
  WHERE id = request_id AND status = 'pending';
END;
$$;

-- Reject leave request function
CREATE OR REPLACE FUNCTION public.reject_leave_request(
  request_id UUID,
  reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rejector_id UUID;
  request_status TEXT;
BEGIN
  -- Get current user ID
  rejector_id := auth.uid();
  
  -- Verify caller is authenticated
  IF rejector_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Verify caller is an admin
  IF NOT has_role(rejector_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can reject requests';
  END IF;
  
  -- Validate reason is provided
  IF reason IS NULL OR length(trim(reason)) = 0 THEN
    RAISE EXCEPTION 'Rejection reason is required';
  END IF;
  
  -- Validate reason length (max 1000 characters)
  IF length(reason) > 1000 THEN
    RAISE EXCEPTION 'Rejection reason must be 1000 characters or less';
  END IF;
  
  -- Check if request exists and is pending
  SELECT status INTO request_status
  FROM leave_requests
  WHERE id = request_id;
  
  IF request_status IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  
  IF request_status != 'pending' THEN
    RAISE EXCEPTION 'Only pending requests can be rejected';
  END IF;
  
  -- Update the request
  UPDATE leave_requests SET
    status = 'rejected',
    rejection_reason = reason,
    updated_at = NOW()
  WHERE id = request_id AND status = 'pending';
END;
$$;

-- Approve overtime request function
CREATE OR REPLACE FUNCTION public.approve_overtime_request(
  request_id UUID,
  notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  approver_id UUID;
  request_status TEXT;
BEGIN
  -- Get current user ID
  approver_id := auth.uid();
  
  -- Verify caller is authenticated
  IF approver_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Verify caller is an admin
  IF NOT has_role(approver_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can approve requests';
  END IF;
  
  -- Validate notes length (max 1000 characters)
  IF notes IS NOT NULL AND length(notes) > 1000 THEN
    RAISE EXCEPTION 'Notes must be 1000 characters or less';
  END IF;
  
  -- Check if request exists and is pending
  SELECT status INTO request_status
  FROM overtime_requests
  WHERE id = request_id;
  
  IF request_status IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  
  IF request_status != 'pending' THEN
    RAISE EXCEPTION 'Only pending requests can be approved';
  END IF;
  
  -- Update the request
  UPDATE overtime_requests SET
    status = 'approved',
    approved_by = approver_id,
    approved_at = NOW(),
    approval_notes = notes,
    updated_at = NOW()
  WHERE id = request_id AND status = 'pending';
END;
$$;

-- Reject overtime request function
CREATE OR REPLACE FUNCTION public.reject_overtime_request(
  request_id UUID,
  reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rejector_id UUID;
  request_status TEXT;
BEGIN
  -- Get current user ID
  rejector_id := auth.uid();
  
  -- Verify caller is authenticated
  IF rejector_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Verify caller is an admin
  IF NOT has_role(rejector_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can reject requests';
  END IF;
  
  -- Validate reason is provided
  IF reason IS NULL OR length(trim(reason)) = 0 THEN
    RAISE EXCEPTION 'Rejection reason is required';
  END IF;
  
  -- Validate reason length (max 1000 characters)
  IF length(reason) > 1000 THEN
    RAISE EXCEPTION 'Rejection reason must be 1000 characters or less';
  END IF;
  
  -- Check if request exists and is pending
  SELECT status INTO request_status
  FROM overtime_requests
  WHERE id = request_id;
  
  IF request_status IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  
  IF request_status != 'pending' THEN
    RAISE EXCEPTION 'Only pending requests can be rejected';
  END IF;
  
  -- Update the request
  UPDATE overtime_requests SET
    status = 'rejected',
    rejection_reason = reason,
    updated_at = NOW()
  WHERE id = request_id AND status = 'pending';
END;
$$;

-- Approve business travel request function
CREATE OR REPLACE FUNCTION public.approve_business_travel_request(
  request_id UUID,
  document_url_param TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  approver_id UUID;
  request_status TEXT;
BEGIN
  -- Get current user ID
  approver_id := auth.uid();
  
  -- Verify caller is authenticated
  IF approver_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Verify caller is an admin
  IF NOT has_role(approver_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can approve requests';
  END IF;
  
  -- Check if request exists and is pending
  SELECT status INTO request_status
  FROM business_travel_requests
  WHERE id = request_id;
  
  IF request_status IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  
  IF request_status != 'pending' THEN
    RAISE EXCEPTION 'Only pending requests can be approved';
  END IF;
  
  -- Update the request
  UPDATE business_travel_requests SET
    status = 'approved',
    approved_by = approver_id,
    approved_at = NOW(),
    document_url = COALESCE(document_url_param, document_url),
    updated_at = NOW()
  WHERE id = request_id AND status = 'pending';
END;
$$;

-- Reject business travel request function
CREATE OR REPLACE FUNCTION public.reject_business_travel_request(
  request_id UUID,
  reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rejector_id UUID;
  request_status TEXT;
BEGIN
  -- Get current user ID
  rejector_id := auth.uid();
  
  -- Verify caller is authenticated
  IF rejector_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Verify caller is an admin
  IF NOT has_role(rejector_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can reject requests';
  END IF;
  
  -- Validate reason is provided
  IF reason IS NULL OR length(trim(reason)) = 0 THEN
    RAISE EXCEPTION 'Rejection reason is required';
  END IF;
  
  -- Validate reason length (max 1000 characters)
  IF length(reason) > 1000 THEN
    RAISE EXCEPTION 'Rejection reason must be 1000 characters or less';
  END IF;
  
  -- Check if request exists and is pending
  SELECT status INTO request_status
  FROM business_travel_requests
  WHERE id = request_id;
  
  IF request_status IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  
  IF request_status != 'pending' THEN
    RAISE EXCEPTION 'Only pending requests can be rejected';
  END IF;
  
  -- Update the request
  UPDATE business_travel_requests SET
    status = 'rejected',
    rejection_reason = reason,
    updated_at = NOW()
  WHERE id = request_id AND status = 'pending';
END;
$$;