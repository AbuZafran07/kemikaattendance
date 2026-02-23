
-- 2. Add deduction columns to payroll table
ALTER TABLE public.payroll 
  ADD COLUMN IF NOT EXISTS loan_deduction numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_deduction numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deduction_notes text,
  ADD COLUMN IF NOT EXISTS bpjs_kes_employer numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bpjs_jht_employer numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bpjs_jp_employer numeric NOT NULL DEFAULT 0;

-- 3. Add RLS policies for HR role on payroll tables
CREATE POLICY "HR can view all payroll" ON public.payroll FOR SELECT USING (public.has_role(auth.uid(), 'hr'::app_role));
CREATE POLICY "HR can insert payroll" ON public.payroll FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'hr'::app_role));
CREATE POLICY "HR can update payroll" ON public.payroll FOR UPDATE USING (public.has_role(auth.uid(), 'hr'::app_role));
CREATE POLICY "HR can delete payroll" ON public.payroll FOR DELETE USING (public.has_role(auth.uid(), 'hr'::app_role));

CREATE POLICY "HR can view all payroll periods" ON public.payroll_periods FOR SELECT USING (public.has_role(auth.uid(), 'hr'::app_role));
CREATE POLICY "HR can insert payroll periods" ON public.payroll_periods FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'hr'::app_role));
CREATE POLICY "HR can update payroll periods" ON public.payroll_periods FOR UPDATE USING (public.has_role(auth.uid(), 'hr'::app_role));
CREATE POLICY "HR can delete payroll periods" ON public.payroll_periods FOR DELETE USING (public.has_role(auth.uid(), 'hr'::app_role));

CREATE POLICY "HR can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'hr'::app_role));
CREATE POLICY "HR can view all attendance" ON public.attendance FOR SELECT USING (public.has_role(auth.uid(), 'hr'::app_role));
CREATE POLICY "HR can view all overtime requests" ON public.overtime_requests FOR SELECT USING (public.has_role(auth.uid(), 'hr'::app_role));
CREATE POLICY "HR can view all settings" ON public.system_settings FOR SELECT USING (public.has_role(auth.uid(), 'hr'::app_role));

-- Employees can view payroll_periods (needed to look up their own payroll)
CREATE POLICY "Employees can view payroll periods" ON public.payroll_periods FOR SELECT USING (auth.uid() IS NOT NULL);
