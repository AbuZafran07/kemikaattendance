CREATE POLICY "Admins can delete all leave requests"
ON public.leave_requests
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));