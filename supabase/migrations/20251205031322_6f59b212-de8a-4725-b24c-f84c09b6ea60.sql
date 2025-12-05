-- Add restrictive policy to deny anonymous access to profiles table
CREATE POLICY "Deny anonymous access to profiles" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Add restrictive policy to deny anonymous access to leave_requests table
CREATE POLICY "Deny anonymous access to leave_requests" 
ON public.leave_requests 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Also add protection to other sensitive tables for consistency
CREATE POLICY "Deny anonymous access to attendance" 
ON public.attendance 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Deny anonymous access to overtime_requests" 
ON public.overtime_requests 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Deny anonymous access to user_roles" 
ON public.user_roles 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Deny anonymous access to system_settings" 
ON public.system_settings 
FOR SELECT 
USING (auth.uid() IS NOT NULL);