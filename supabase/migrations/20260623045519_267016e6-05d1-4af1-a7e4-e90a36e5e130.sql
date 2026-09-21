CREATE TABLE public.final_settlements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resign_date DATE,
  period_month INT NOT NULL,
  period_year INT NOT NULL,
  pesangon_amount NUMERIC NOT NULL DEFAULT 0,
  loan_payoff NUMERIC NOT NULL DEFAULT 0,
  remaining_leave_days INT NOT NULL DEFAULT 0,
  net_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.final_settlements TO authenticated;
GRANT ALL ON public.final_settlements TO service_role;

ALTER TABLE public.final_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage final settlements"
ON public.final_settlements FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Employees view own final settlement"
ON public.final_settlements FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE TRIGGER update_final_settlements_updated_at
BEFORE UPDATE ON public.final_settlements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();