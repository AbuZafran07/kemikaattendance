
-- Add fixed allowance columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN tunjangan_komunikasi numeric DEFAULT 0,
ADD COLUMN tunjangan_jabatan numeric DEFAULT 0,
ADD COLUMN tunjangan_operasional numeric DEFAULT 0;
