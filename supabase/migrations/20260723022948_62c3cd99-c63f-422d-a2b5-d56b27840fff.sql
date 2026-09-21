
-- Contract fields on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS contract_start_date DATE,
  ADD COLUMN IF NOT EXISTS contract_end_date DATE,
  ADD COLUMN IF NOT EXISTS contract_number TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_contract_end_date ON public.profiles(contract_end_date) WHERE contract_end_date IS NOT NULL;

-- Employee documents table
CREATE TABLE IF NOT EXISTS public.employee_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  issued_date DATE,
  expiry_date DATE,
  notes TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_documents_user_id ON public.employee_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_documents_expiry ON public.employee_documents(expiry_date) WHERE expiry_date IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_documents TO authenticated;
GRANT ALL ON public.employee_documents TO service_role;

ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and HR manage all employee documents"
  ON public.employee_documents FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'hr'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'hr'::public.app_role));

CREATE POLICY "Employees view own documents"
  ON public.employee_documents FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER trg_employee_documents_updated
  BEFORE UPDATE ON public.employee_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage RLS policies (bucket "employee-documents" already exists). Path = <user_id>/<filename>
CREATE POLICY "Admin/HR manage employee-documents"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'employee-documents' AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'hr'::public.app_role)))
  WITH CHECK (bucket_id = 'employee-documents' AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'hr'::public.app_role)));

CREATE POLICY "Employees read own employee-documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'employee-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
