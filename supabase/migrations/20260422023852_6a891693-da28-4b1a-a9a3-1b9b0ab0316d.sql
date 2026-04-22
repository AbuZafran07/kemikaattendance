ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS bpjs_ketenagakerjaan_enabled boolean NOT NULL DEFAULT true;