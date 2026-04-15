CREATE POLICY "Admins can delete all overtime requests"
ON public.overtime_requests
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete all business travel requests"
ON public.business_travel_requests
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));