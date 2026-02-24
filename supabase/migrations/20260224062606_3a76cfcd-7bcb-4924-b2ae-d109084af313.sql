
-- Add BPJS Kesehatan opt-out flag to profiles
ALTER TABLE public.profiles ADD COLUMN bpjs_kesehatan_enabled boolean NOT NULL DEFAULT true;
