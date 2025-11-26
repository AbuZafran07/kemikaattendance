-- Fix profiles table RLS policy to protect sensitive employee PII
DROP POLICY IF EXISTS "Profiles are viewable by everyone authenticated" ON public.profiles;

CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

-- Create security definer function for office location access
CREATE OR REPLACE FUNCTION public.get_office_location()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT value 
  FROM public.system_settings 
  WHERE key = 'office_location'
  LIMIT 1
$$;