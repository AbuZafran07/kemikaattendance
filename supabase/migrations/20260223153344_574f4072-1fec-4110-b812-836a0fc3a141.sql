
-- Add basic_salary and ptkp_status to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS basic_salary numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS ptkp_status text DEFAULT 'TK/0';

-- Create payroll_periods table
CREATE TABLE public.payroll_periods (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  year integer NOT NULL CHECK (year >= 2020 AND year <= 2100),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'finalized')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (month, year)
);

-- Create payroll table
CREATE TABLE public.payroll (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  period_id uuid NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
  basic_salary numeric NOT NULL DEFAULT 0,
  allowance numeric NOT NULL DEFAULT 0,
  overtime_total numeric NOT NULL DEFAULT 0,
  bruto_income numeric NOT NULL DEFAULT 0,
  bpjs_kesehatan numeric NOT NULL DEFAULT 0,
  bpjs_ketenagakerjaan numeric NOT NULL DEFAULT 0,
  netto_income numeric NOT NULL DEFAULT 0,
  ptkp_status text NOT NULL DEFAULT 'TK/0',
  ptkp_value numeric NOT NULL DEFAULT 54000000,
  pkp numeric NOT NULL DEFAULT 0,
  pph21_monthly numeric NOT NULL DEFAULT 0,
  take_home_pay numeric NOT NULL DEFAULT 0,
  overtime_hours numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, period_id)
);

-- Enable RLS
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll ENABLE ROW LEVEL SECURITY;

-- RLS for payroll_periods: admin full access
CREATE POLICY "Admins can view all payroll periods"
  ON public.payroll_periods FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert payroll periods"
  ON public.payroll_periods FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update payroll periods"
  ON public.payroll_periods FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete payroll periods"
  ON public.payroll_periods FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Deny anonymous
CREATE POLICY "Deny anonymous access to payroll_periods"
  ON public.payroll_periods FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- RLS for payroll: admin full access, employee own data
CREATE POLICY "Admins can view all payroll"
  ON public.payroll FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert payroll"
  ON public.payroll FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update payroll"
  ON public.payroll FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete payroll"
  ON public.payroll FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Employees can view own payroll"
  ON public.payroll FOR SELECT
  USING (auth.uid() = user_id);

-- Deny anonymous
CREATE POLICY "Deny anonymous access to payroll"
  ON public.payroll FOR SELECT
  USING (auth.uid() IS NOT NULL);
