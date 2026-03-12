
-- Drop restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Admins can manage announcements" ON public.company_announcements;
DROP POLICY IF EXISTS "Anyone can view active announcements" ON public.company_announcements;

-- Recreate as PERMISSIVE (default)
CREATE POLICY "Admins can manage announcements"
ON public.company_announcements
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active announcements"
ON public.company_announcements
FOR SELECT
USING (is_active = true);
