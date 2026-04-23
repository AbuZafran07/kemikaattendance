-- Add resign_date column to profiles table for tracking when an employee resigned
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS resign_date date;

COMMENT ON COLUMN public.profiles.resign_date IS 'Tanggal karyawan resign (hanya diisi jika status = Resigned). Untuk arsip historis.';