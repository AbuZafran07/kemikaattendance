
CREATE TABLE public.approval_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_type TEXT NOT NULL,
  request_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  performed_by UUID NOT NULL,
  target_user_id UUID NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.approval_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view approval audit logs"
  ON public.approval_audit_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can insert approval audit logs"
  ON public.approval_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "HR can view approval audit logs"
  ON public.approval_audit_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'hr'::public.app_role));

CREATE POLICY "Deny anonymous access to approval_audit_logs"
  ON public.approval_audit_logs FOR SELECT
  TO public
  USING (auth.uid() IS NOT NULL);
