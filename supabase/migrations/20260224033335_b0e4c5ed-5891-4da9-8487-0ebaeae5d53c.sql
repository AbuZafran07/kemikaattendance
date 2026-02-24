-- Add incidental income and fixed allowance breakdown columns to payroll table
ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS tunjangan_komunikasi numeric NOT NULL DEFAULT 0;
ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS tunjangan_jabatan numeric NOT NULL DEFAULT 0;
ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS tunjangan_operasional numeric NOT NULL DEFAULT 0;
ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS tunjangan_kesehatan numeric NOT NULL DEFAULT 0;
ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS bonus_tahunan numeric NOT NULL DEFAULT 0;
ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS thr numeric NOT NULL DEFAULT 0;
ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS insentif_kinerja numeric NOT NULL DEFAULT 0;
ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS bonus_lainnya numeric NOT NULL DEFAULT 0;
ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS pengembalian_employee numeric NOT NULL DEFAULT 0;
ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS insentif_penjualan numeric NOT NULL DEFAULT 0;