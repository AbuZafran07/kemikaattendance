ALTER TABLE public.business_travel_requests
  ADD COLUMN IF NOT EXISTS ca_document_url text,
  ADD COLUMN IF NOT EXISTS ca_number text,
  ADD COLUMN IF NOT EXISTS ca_uploaded_at timestamp with time zone;