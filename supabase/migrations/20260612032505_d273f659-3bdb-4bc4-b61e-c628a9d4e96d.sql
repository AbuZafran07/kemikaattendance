
-- 1. Add tunjangan_perjalanan_dinas column to payroll_overrides and payroll
ALTER TABLE public.payroll_overrides
  ADD COLUMN IF NOT EXISTS tunjangan_perjalanan_dinas numeric NOT NULL DEFAULT 0;

ALTER TABLE public.payroll
  ADD COLUMN IF NOT EXISTS tunjangan_perjalanan_dinas numeric NOT NULL DEFAULT 0;

-- 2. Insert default config for business travel allowance
INSERT INTO public.system_settings (key, value, description)
VALUES (
  'business_travel_allowance_config',
  '{"per_day_amount": 100000, "enabled": true}'::jsonb,
  'Konfigurasi tunjangan perjalanan dinas: nilai per hari (flat) dan status aktif.'
)
ON CONFLICT (key) DO NOTHING;

-- 3. RPC to read the config
CREATE OR REPLACE FUNCTION public.get_business_travel_allowance_config()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT value FROM public.system_settings WHERE key = 'business_travel_allowance_config';
$$;
