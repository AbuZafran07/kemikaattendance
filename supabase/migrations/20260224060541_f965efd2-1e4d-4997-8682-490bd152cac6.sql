
-- Add JKK and JKM employer columns to payroll table
ALTER TABLE public.payroll ADD COLUMN bpjs_jkk_employer numeric NOT NULL DEFAULT 0;
ALTER TABLE public.payroll ADD COLUMN bpjs_jkm_employer numeric NOT NULL DEFAULT 0;
