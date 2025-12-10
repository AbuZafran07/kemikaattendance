
-- Create business_travel_requests table
CREATE TABLE public.business_travel_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  destination TEXT NOT NULL,
  purpose TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days INTEGER NOT NULL,
  notes TEXT,
  status leave_status NOT NULL DEFAULT 'pending',
  document_url TEXT,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.business_travel_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own business travel requests"
ON public.business_travel_requests
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all business travel requests"
ON public.business_travel_requests
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert their own business travel requests"
ON public.business_travel_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pending business travel requests"
ON public.business_travel_requests
FOR UPDATE
USING ((auth.uid() = user_id) AND (status = 'pending'::leave_status));

CREATE POLICY "Admins can update all business travel requests"
ON public.business_travel_requests
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can delete their own pending business travel requests"
ON public.business_travel_requests
FOR DELETE
USING ((auth.uid() = user_id) AND (status = 'pending'::leave_status));

CREATE POLICY "Deny anonymous access to business_travel_requests"
ON public.business_travel_requests
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Create trigger for updated_at
CREATE TRIGGER update_business_travel_requests_updated_at
BEFORE UPDATE ON public.business_travel_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for business travel documents
INSERT INTO storage.buckets (id, name, public) VALUES ('business-travel-docs', 'business-travel-docs', false);

-- Storage policies for business travel documents
CREATE POLICY "Admins can upload business travel documents"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'business-travel-docs' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update business travel documents"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'business-travel-docs' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete business travel documents"
ON storage.objects
FOR DELETE
USING (bucket_id = 'business-travel-docs' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view business travel documents"
ON storage.objects
FOR SELECT
USING (bucket_id = 'business-travel-docs' AND auth.uid() IS NOT NULL);

-- Enable realtime for the table
ALTER PUBLICATION supabase_realtime ADD TABLE public.business_travel_requests;
