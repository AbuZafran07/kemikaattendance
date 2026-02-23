CREATE POLICY "Admins can insert attendance"
ON public.attendance
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));