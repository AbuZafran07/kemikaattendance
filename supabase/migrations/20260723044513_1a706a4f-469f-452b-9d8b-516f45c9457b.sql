
-- Training programs (master)
CREATE TABLE public.training_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  provider TEXT,
  cost NUMERIC(15,2) DEFAULT 0,
  duration_hours NUMERIC(6,2),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.training_programs TO authenticated;
GRANT ALL ON public.training_programs TO service_role;
ALTER TABLE public.training_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can view training programs"
  ON public.training_programs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/HR insert training programs"
  ON public.training_programs FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'hr'::public.app_role));
CREATE POLICY "Admin/HR update training programs"
  ON public.training_programs FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'hr'::public.app_role));
CREATE POLICY "Admin/HR delete training programs"
  ON public.training_programs FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'hr'::public.app_role));

CREATE TRIGGER trg_training_programs_updated
  BEFORE UPDATE ON public.training_programs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Employee trainings (history)
CREATE TABLE public.employee_trainings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  training_id UUID REFERENCES public.training_programs(id) ON DELETE SET NULL,
  training_name TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'planned', -- planned, ongoing, completed, cancelled
  certificate_url TEXT,
  score NUMERIC(6,2),
  expiry_date DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_trainings TO authenticated;
GRANT ALL ON public.employee_trainings TO service_role;
ALTER TABLE public.employee_trainings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees view own trainings"
  ON public.employee_trainings FOR SELECT TO authenticated
  USING (
    employee_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'hr'::public.app_role)
  );
CREATE POLICY "Employees insert own trainings"
  ON public.employee_trainings FOR INSERT TO authenticated
  WITH CHECK (
    employee_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'hr'::public.app_role)
  );
CREATE POLICY "Employees update own trainings"
  ON public.employee_trainings FOR UPDATE TO authenticated
  USING (
    employee_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'hr'::public.app_role)
  );
CREATE POLICY "Admin/HR delete trainings"
  ON public.employee_trainings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'hr'::public.app_role));

CREATE TRIGGER trg_employee_trainings_updated
  BEFORE UPDATE ON public.employee_trainings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_employee_trainings_employee ON public.employee_trainings(employee_id);
CREATE INDEX idx_employee_trainings_expiry ON public.employee_trainings(expiry_date) WHERE expiry_date IS NOT NULL;
