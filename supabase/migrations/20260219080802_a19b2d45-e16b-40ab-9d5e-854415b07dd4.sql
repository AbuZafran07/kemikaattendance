
-- Create audit log table for attendance changes
CREATE TABLE public.attendance_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id uuid NOT NULL,
  action_type text NOT NULL, -- 'edit' or 'delete'
  changed_by uuid NOT NULL,
  old_data jsonb NOT NULL,
  new_data jsonb,
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.attendance_audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view attendance audit logs"
ON public.attendance_audit_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can insert audit logs
CREATE POLICY "Admins can insert attendance audit logs"
ON public.attendance_audit_logs
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Deny anonymous access
CREATE POLICY "Deny anonymous access to attendance_audit_logs"
ON public.attendance_audit_logs
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Allow admins to delete attendance records
CREATE POLICY "Admins can delete attendance"
ON public.attendance
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));
