-- Fix: Allow anyone (including unauthenticated) to view active announcements on landing page
DROP POLICY IF EXISTS "Authenticated users can view active announcements" ON public.company_announcements;

CREATE POLICY "Anyone can view active announcements"
ON public.company_announcements
FOR SELECT
TO public
USING (is_active = true);

-- Add expire_at column for expiry date feature
ALTER TABLE public.company_announcements ADD COLUMN IF NOT EXISTS expire_at timestamptz DEFAULT NULL;