-- Add fcm_token column to profiles for storing Firebase Cloud Messaging tokens
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS fcm_token TEXT;

-- Add index for efficient querying of low leave quota
CREATE INDEX IF NOT EXISTS idx_profiles_remaining_leave ON public.profiles (remaining_leave);

-- Create function to check low leave quota employees
CREATE OR REPLACE FUNCTION public.get_low_leave_quota_employees(threshold INTEGER DEFAULT 3)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  email TEXT,
  remaining_leave INTEGER,
  fcm_token TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id as user_id,
    full_name,
    email,
    remaining_leave,
    fcm_token
  FROM profiles
  WHERE remaining_leave IS NOT NULL 
    AND remaining_leave <= threshold
    AND remaining_leave > 0
    AND fcm_token IS NOT NULL;
$$;