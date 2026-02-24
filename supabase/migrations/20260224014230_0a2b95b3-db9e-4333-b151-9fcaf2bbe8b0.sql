
-- Create TER rates table for PPh21 calculation (Jan-Nov)
CREATE TABLE public.pph21_ter_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kategori_ptkp TEXT NOT NULL,
  bruto_min NUMERIC NOT NULL DEFAULT 0,
  bruto_max NUMERIC NOT NULL DEFAULT 0,
  tarif_efektif NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pph21_ter_rates ENABLE ROW LEVEL SECURITY;

-- Admins can manage TER rates
CREATE POLICY "Admins can manage TER rates" ON public.pph21_ter_rates
FOR ALL USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- HR can view TER rates
CREATE POLICY "HR can view TER rates" ON public.pph21_ter_rates
FOR SELECT USING (public.has_role(auth.uid(), 'hr'::public.app_role));

-- Deny anonymous
CREATE POLICY "Deny anonymous access to pph21_ter_rates" ON public.pph21_ter_rates
FOR SELECT USING (auth.uid() IS NOT NULL);

-- Add pph21_calculation_mode column to payroll to track TER vs REKONSILIASI
ALTER TABLE public.payroll ADD COLUMN pph21_mode TEXT NOT NULL DEFAULT 'progressive';
ALTER TABLE public.payroll ADD COLUMN pph21_ter_rate NUMERIC DEFAULT 0;

-- Add trigger for updated_at
CREATE TRIGGER update_pph21_ter_rates_updated_at
BEFORE UPDATE ON public.pph21_ter_rates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
