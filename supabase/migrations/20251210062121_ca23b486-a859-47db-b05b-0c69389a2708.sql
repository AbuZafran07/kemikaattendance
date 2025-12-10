-- Allow users to delete their own pending leave requests
CREATE POLICY "Users can delete their own pending leave requests"
ON public.leave_requests
FOR DELETE
USING (auth.uid() = user_id AND status = 'pending'::leave_status);

-- Allow users to delete their own pending overtime requests
CREATE POLICY "Users can delete their own pending overtime requests"
ON public.overtime_requests
FOR DELETE
USING (auth.uid() = user_id AND status = 'pending'::leave_status);