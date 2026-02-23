
-- Employee loans table
CREATE TABLE public.employee_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  loan_type text NOT NULL DEFAULT 'pinjaman', -- pinjaman, kasbon
  description text,
  total_amount numeric NOT NULL DEFAULT 0,
  monthly_installment numeric NOT NULL DEFAULT 0,
  total_installments integer NOT NULL DEFAULT 1,
  paid_installments integer NOT NULL DEFAULT 0,
  remaining_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active', -- active, completed, cancelled
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_loans ENABLE ROW LEVEL SECURITY;

-- Admin/HR full access
CREATE POLICY "Admins can manage loans" ON public.employee_loans FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "HR can manage loans" ON public.employee_loans FOR ALL USING (public.has_role(auth.uid(), 'hr'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'hr'::app_role));
-- Employee can view own
CREATE POLICY "Employees can view own loans" ON public.employee_loans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Deny anon loans" ON public.employee_loans FOR SELECT USING (auth.uid() IS NOT NULL);

-- Loan installment payments (history)
CREATE TABLE public.loan_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES public.employee_loans(id) ON DELETE CASCADE,
  installment_number integer NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  payment_date date,
  payroll_period_id uuid REFERENCES public.payroll_periods(id),
  status text NOT NULL DEFAULT 'pending', -- pending, paid, skipped
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.loan_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage installments" ON public.loan_installments FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "HR can manage installments" ON public.loan_installments FOR ALL USING (public.has_role(auth.uid(), 'hr'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'hr'::app_role));
CREATE POLICY "Employees can view own installments" ON public.loan_installments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.employee_loans el WHERE el.id = loan_id AND el.user_id = auth.uid())
);
CREATE POLICY "Deny anon installments" ON public.loan_installments FOR SELECT USING (auth.uid() IS NOT NULL);

-- Trigger to auto-update updated_at
CREATE TRIGGER update_employee_loans_updated_at
  BEFORE UPDATE ON public.employee_loans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
