
-- Tabel histori perubahan gaji & tunjangan tetap karyawan
CREATE TABLE public.salary_change_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  changed_by UUID NOT NULL,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT NOT NULL,
  old_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  new_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  changed_fields TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_salary_history_user ON public.salary_change_history(user_id, created_at DESC);

ALTER TABLE public.salary_change_history ENABLE ROW LEVEL SECURITY;

-- Force authentication
CREATE POLICY "Require authentication on salary history"
ON public.salary_change_history
AS RESTRICTIVE
FOR ALL
USING (auth.uid() IS NOT NULL);

-- Admin: full manage
CREATE POLICY "Admins manage salary history"
ON public.salary_change_history
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- HR: view + insert
CREATE POLICY "HR view salary history"
ON public.salary_change_history
FOR SELECT
USING (public.has_role(auth.uid(), 'hr'::public.app_role));

CREATE POLICY "HR insert salary history"
ON public.salary_change_history
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'hr'::public.app_role) AND changed_by = auth.uid());

-- Employee: view own
CREATE POLICY "Employees view own salary history"
ON public.salary_change_history
FOR SELECT
USING (auth.uid() = user_id);
