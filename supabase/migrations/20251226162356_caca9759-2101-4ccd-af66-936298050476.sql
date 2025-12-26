-- Fix the reject_leave_request function to avoid ambiguous column reference
-- The parameter 'reason' conflicts with the 'reason' column in leave_requests table

CREATE OR REPLACE FUNCTION public.reject_leave_request(request_id uuid, reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rejector_id UUID;
  request_status TEXT;
  rejection_reason_param ALIAS FOR reason;
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
  IF rejection_reason_param IS NULL OR length(trim(rejection_reason_param)) = 0 THEN
    RAISE EXCEPTION 'Rejection reason is required';
  END IF;
  
  -- Validate reason length (max 1000 characters)
  IF length(rejection_reason_param) > 1000 THEN
    RAISE EXCEPTION 'Rejection reason must be 1000 characters or less';
  END IF;
  
  -- Check if request exists and is pending
  SELECT l.status INTO request_status
  FROM leave_requests l
  WHERE l.id = request_id;
  
  IF request_status IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  
  IF request_status != 'pending' THEN
    RAISE EXCEPTION 'Only pending requests can be rejected';
  END IF;
  
  -- Update the request
  UPDATE leave_requests l SET
    status = 'rejected',
    rejection_reason = rejection_reason_param,
    updated_at = NOW()
  WHERE l.id = request_id AND l.status = 'pending';
END;
$function$;