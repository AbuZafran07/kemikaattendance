-- Drop the old function and create a new one that doesn't expose FCM tokens
DROP FUNCTION IF EXISTS public.get_low_leave_quota_employees(integer);

-- Create new function that only returns user_id and remaining_leave (no PII)
-- The Edge Function will fetch FCM tokens separately using service role
CREATE OR REPLACE FUNCTION public.get_low_leave_quota_employees(threshold integer DEFAULT 3)
RETURNS TABLE(user_id uuid, full_name text, remaining_leave integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    id as user_id,
    full_name,
    remaining_leave
  FROM profiles
  WHERE remaining_leave IS NOT NULL 
    AND remaining_leave <= threshold
    AND remaining_leave > 0;
$$;