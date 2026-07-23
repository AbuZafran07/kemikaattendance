
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reports_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_reports_to ON public.profiles(reports_to);
