-- ============================================================
-- SPECIAL LEAVE TYPES (izin khusus / life-event, event-based, no quota deduction)
-- ============================================================

CREATE TABLE public.special_leave_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  default_duration_days integer NOT NULL CHECK (default_duration_days > 0),
  requires_document boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.special_leave_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view active special leave types" ON public.special_leave_types
  FOR SELECT TO authenticated
  USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role));

CREATE POLICY "Admin and HR manage special leave types" ON public.special_leave_types
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role));

CREATE POLICY "Admin and HR update special leave types" ON public.special_leave_types
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role));

CREATE POLICY "Admin and HR delete special leave types" ON public.special_leave_types
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role));

CREATE TRIGGER update_special_leave_types_updated_at BEFORE UPDATE ON public.special_leave_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.special_leave_types (code, name, default_duration_days, requires_document, display_order) VALUES
  ('marriage_self', 'Pernikahan Karyawan', 3, true, 1),
  ('marriage_child', 'Pernikahan Anak Karyawan', 2, true, 2),
  ('circumcision_baptism', 'Khitanan/Baptis Anak Karyawan', 2, true, 3),
  ('wife_childbirth', 'Istri Melahirkan/Keguguran', 2, true, 4),
  ('family_death', 'Suami/Istri/Orang Tua/Mertua/Anak/Menantu Meninggal', 2, true, 5),
  ('housemate_death', 'Anggota Keluarga dalam Satu Rumah Meninggal', 1, true, 6);

-- leave_requests: link to the chosen special leave type + optional supporting document
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS special_leave_type_id uuid
  REFERENCES public.special_leave_types(id) ON DELETE SET NULL;
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS attachment_url text;

-- Storage bucket for supporting documents (surat nikah/akta kematian/dll), private,
-- one folder per user (mirrors the unlock-letters bucket convention).
INSERT INTO storage.buckets (id, name, public)
VALUES ('leave-attachments', 'leave-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users upload own leave attachments" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'leave-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users view own leave attachments" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'leave-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Admin HR view all leave attachments" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'leave-attachments' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role)));
