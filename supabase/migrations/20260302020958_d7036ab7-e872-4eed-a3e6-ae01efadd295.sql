
-- Create company announcements table
CREATE TABLE public.company_announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info', -- info, warning, success
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_announcements ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage announcements"
ON public.company_announcements
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- All authenticated users can view active announcements
CREATE POLICY "Authenticated users can view active announcements"
ON public.company_announcements
FOR SELECT
USING (auth.uid() IS NOT NULL AND is_active = true);

-- Anyone (including unauthenticated) can view active announcements for landing page
CREATE POLICY "Public can view active announcements"
ON public.company_announcements
FOR SELECT
USING (is_active = true);

-- Trigger for updated_at
CREATE TRIGGER update_company_announcements_updated_at
BEFORE UPDATE ON public.company_announcements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
