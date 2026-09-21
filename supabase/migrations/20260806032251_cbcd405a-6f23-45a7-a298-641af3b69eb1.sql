CREATE TABLE public.backup_audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action_type text NOT NULL CHECK (action_type IN ('RESTORE_BACKUP','DELETE_BACKUP','CREATE_BACKUP','PRE_RESTORE_SNAPSHOT','EXPORT_EXCEL')),
  file_name text NOT NULL,
  records integer NOT NULL DEFAULT 0,
  tables_affected text[] ,
  performed_by uuid NOT NULL DEFAULT auth.uid(),
  notes text,
  details jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.backup_audit_logs TO authenticated;
GRANT ALL ON public.backup_audit_logs TO service_role;

ALTER TABLE public.backup_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and HR can view backup audit logs"
ON public.backup_audit_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'hr'::public.app_role));

CREATE POLICY "Admin and HR can insert backup audit logs"
ON public.backup_audit_logs FOR INSERT TO authenticated
WITH CHECK (
  performed_by = auth.uid()
  AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'hr'::public.app_role))
);

CREATE INDEX idx_backup_audit_logs_created_at ON public.backup_audit_logs (created_at DESC);