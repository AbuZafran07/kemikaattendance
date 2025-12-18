-- Update get_low_leave_quota_employees function to require admin role
CREATE OR REPLACE FUNCTION public.get_low_leave_quota_employees(threshold integer DEFAULT 3)
 RETURNS TABLE(user_id uuid, full_name text, remaining_leave integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Verify caller is an admin
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  
  RETURN QUERY
  SELECT 
    p.id as user_id,
    p.full_name,
    p.remaining_leave
  FROM profiles p
  WHERE p.remaining_leave IS NOT NULL 
    AND p.remaining_leave <= threshold
    AND p.remaining_leave > 0;
END;
$function$;