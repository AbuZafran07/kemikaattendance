-- LATE REASONS
CREATE TABLE public.late_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id uuid NOT NULL REFERENCES public.attendance(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  reason text NOT NULL,
  description text,
  attachment_url text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','no_reason_submitted')),
  approved_by uuid,
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.late_reasons TO authenticated;
GRANT ALL ON public.late_reasons TO service_role;
ALTER TABLE public.late_reasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin and HR full access late_reasons" ON public.late_reasons FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'hr'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'hr'::app_role));
CREATE POLICY "Employees view own late_reasons" ON public.late_reasons FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ATTENDANCE VIOLATIONS
CREATE TABLE public.attendance_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  attendance_id uuid REFERENCES public.attendance(id) ON DELETE SET NULL,
  late_reason_id uuid REFERENCES public.late_reasons(id) ON DELETE SET NULL,
  violation_date date NOT NULL,
  violation_type text NOT NULL CHECK (violation_type IN (
    'late_reason_rejected','late_no_reason_submitted','absent_without_permission',
    'no_attendance_record','permission_rejected','leave_rejected')),
  description text,
  is_counted boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'system' CHECK (source IN ('system','hr')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX attendance_violations_unique_counted
  ON public.attendance_violations (user_id, violation_date) WHERE is_counted = true;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_violations TO authenticated;
GRANT ALL ON public.attendance_violations TO service_role;
ALTER TABLE public.attendance_violations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin and HR full access attendance_violations" ON public.attendance_violations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'hr'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'hr'::app_role));
CREATE POLICY "Employees view own attendance_violations" ON public.attendance_violations FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- DISCIPLINARY ACTIONS
CREATE TABLE public.disciplinary_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  warning_type text NOT NULL CHECK (warning_type IN ('sp1','sp2')),
  period_month date NOT NULL,
  violation_count_at_issuance integer NOT NULL,
  issue_date timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','superseded')),
  document_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, warning_type, period_month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.disciplinary_actions TO authenticated;
GRANT ALL ON public.disciplinary_actions TO service_role;
ALTER TABLE public.disciplinary_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin and HR full access disciplinary_actions" ON public.disciplinary_actions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'hr'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'hr'::app_role));
CREATE POLICY "Employees view own disciplinary_actions" ON public.disciplinary_actions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- EMPLOYEE COACHING
CREATE TABLE public.employee_coaching (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  related_lock_id uuid,
  coaching_date timestamptz NOT NULL DEFAULT now(),
  violation_count integer,
  current_warning_level text,
  coaching_type text,
  coaching_notes text,
  follow_up text,
  hr_pic uuid NOT NULL,
  attachment_url text,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_coaching TO authenticated;
GRANT ALL ON public.employee_coaching TO service_role;
ALTER TABLE public.employee_coaching ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin and HR full access employee_coaching" ON public.employee_coaching FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'hr'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'hr'::app_role));
CREATE POLICY "Employees view own employee_coaching" ON public.employee_coaching FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE TRIGGER update_employee_coaching_updated_at BEFORE UPDATE ON public.employee_coaching
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ACCOUNT LOCKS
CREATE TABLE public.account_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  locked_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL,
  violation_count_at_lock integer NOT NULL,
  status text NOT NULL DEFAULT 'locked' CHECK (status IN ('locked','unlocked')),
  coaching_id uuid REFERENCES public.employee_coaching(id) ON DELETE SET NULL,
  unlock_letter_id uuid,
  unlocked_at timestamptz,
  unlocked_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_locks TO authenticated;
GRANT ALL ON public.account_locks TO service_role;
ALTER TABLE public.account_locks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin and HR full access account_locks" ON public.account_locks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'hr'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'hr'::app_role));
CREATE POLICY "Employees view own account_locks" ON public.account_locks FOR SELECT TO authenticated
  USING (user_id = auth.uid());

ALTER TABLE public.employee_coaching
  ADD CONSTRAINT employee_coaching_related_lock_fkey
  FOREIGN KEY (related_lock_id) REFERENCES public.account_locks(id) ON DELETE SET NULL;

-- ACCOUNT UNLOCK LETTERS
CREATE TABLE public.account_unlock_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lock_id uuid NOT NULL REFERENCES public.account_locks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  letter_number text NOT NULL,
  statement_text text NOT NULL,
  employee_signature_data text NOT NULL,
  employee_signed_at timestamptz NOT NULL DEFAULT now(),
  hr_signature_data text,
  hr_signed_by uuid,
  hr_signed_at timestamptz,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','approved','rejected')),
  rejection_reason text,
  document_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_unlock_letters TO authenticated;
GRANT ALL ON public.account_unlock_letters TO service_role;
ALTER TABLE public.account_unlock_letters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin and HR full access account_unlock_letters" ON public.account_unlock_letters FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'hr'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'hr'::app_role));
CREATE POLICY "Employees view own account_unlock_letters" ON public.account_unlock_letters FOR SELECT TO authenticated
  USING (user_id = auth.uid());

ALTER TABLE public.account_locks
  ADD CONSTRAINT account_locks_unlock_letter_fkey
  FOREIGN KEY (unlock_letter_id) REFERENCES public.account_unlock_letters(id) ON DELETE SET NULL;

-- ATTENDANCE NOTIFICATIONS
CREATE TABLE public.attendance_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  notif_type text NOT NULL CHECK (notif_type IN (
    'late_reason_pending','monthly_violation_progress','sp1_issued','sp2_issued',
    'lock_warning','account_locked','account_unlocked','rolling_3month_warning','unlock_letter_submitted')),
  title text NOT NULL,
  message text NOT NULL,
  related_id uuid,
  target_role text CHECK (target_role IN ('employee','hr')),
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_notifications TO authenticated;
GRANT ALL ON public.attendance_notifications TO service_role;
ALTER TABLE public.attendance_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin and HR full access attendance_notifications" ON public.attendance_notifications FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'hr'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'hr'::app_role));
CREATE POLICY "Employees view own attendance_notifications" ON public.attendance_notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- EXISTING TABLE COLUMNS
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS late_minutes integer;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active';
ALTER TABLE public.profiles ADD CONSTRAINT profiles_account_status_check
  CHECK (account_status IN ('active','locked'));

-- SETTINGS
INSERT INTO public.system_settings (key, value, description)
VALUES (
  'attendance_discipline_config',
  '{"sp1_threshold":5,"sp2_threshold":8,"lock_threshold":11,"three_month_warning_threshold":10,"late_reason_deadline_hours":24,"enable_progress_notifications":true}'::jsonb,
  'Konfigurasi ambang batas sistem disiplin absensi (SP1, SP2, lock akun, peringatan 3 bulan)'
)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_attendance_discipline_config()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT value
  FROM public.system_settings
  WHERE key = 'attendance_discipline_config';
$$;

REVOKE EXECUTE ON FUNCTION public.get_attendance_discipline_config() FROM anon;