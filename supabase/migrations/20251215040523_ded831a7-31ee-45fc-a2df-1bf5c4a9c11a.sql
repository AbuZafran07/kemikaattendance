-- Add work_type column to profiles table for hybrid/WFO/WFA support
ALTER TABLE public.profiles 
ADD COLUMN work_type text NOT NULL DEFAULT 'wfo';

-- Add comment for clarity
COMMENT ON COLUMN public.profiles.work_type IS 'Work type: wfo (Work From Office), wfa (Work From Anywhere/Hybrid)';