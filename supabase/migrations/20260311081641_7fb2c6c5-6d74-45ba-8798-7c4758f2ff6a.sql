
CREATE TABLE public.company_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.company_events ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can view events
CREATE POLICY "Anyone authenticated can view events"
  ON public.company_events FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Admins can manage events
CREATE POLICY "Admins can manage events"
  ON public.company_events FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Deny anonymous
CREATE POLICY "Deny anonymous access to company_events"
  ON public.company_events FOR SELECT
  TO public
  USING (auth.uid() IS NOT NULL);
