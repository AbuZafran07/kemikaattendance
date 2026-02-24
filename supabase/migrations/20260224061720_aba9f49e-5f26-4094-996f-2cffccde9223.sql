
-- Table to store payroll overrides (income additions & deductions) per employee per month
CREATE TABLE public.payroll_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  period_month INTEGER NOT NULL,
  period_year INTEGER NOT NULL,
  -- Income additions
  tunjangan_kehadiran NUMERIC NOT NULL DEFAULT 0,
  tunjangan_kesehatan NUMERIC NOT NULL DEFAULT 0,
  bonus_tahunan NUMERIC NOT NULL DEFAULT 0,
  thr NUMERIC NOT NULL DEFAULT 0,
  insentif_kinerja NUMERIC NOT NULL DEFAULT 0,
  bonus_lainnya NUMERIC NOT NULL DEFAULT 0,
  pengembalian_employee NUMERIC NOT NULL DEFAULT 0,
  insentif_penjualan NUMERIC NOT NULL DEFAULT 0,
  -- Deductions
  loan_deduction NUMERIC NOT NULL DEFAULT 0,
  other_deduction NUMERIC NOT NULL DEFAULT 0,
  deduction_notes TEXT DEFAULT '',
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- Unique constraint: one override per employee per month
  UNIQUE(user_id, period_month, period_year)
);

-- Enable RLS
ALTER TABLE public.payroll_overrides ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage payroll overrides"
ON public.payroll_overrides FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "HR can manage payroll overrides"
ON public.payroll_overrides FOR ALL
USING (has_role(auth.uid(), 'hr'::app_role))
WITH CHECK (has_role(auth.uid(), 'hr'::app_role));

CREATE POLICY "Deny anonymous access to payroll_overrides"
ON public.payroll_overrides FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Auto-update timestamp trigger
CREATE TRIGGER update_payroll_overrides_updated_at
BEFORE UPDATE ON public.payroll_overrides
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
