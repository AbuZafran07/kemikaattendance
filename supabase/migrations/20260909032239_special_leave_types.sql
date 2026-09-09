-- Izin Khusus (life-event leave) — Langkah 2: tabel jenis, kolom baru di
-- leave_requests, dan storage bucket untuk lampiran dokumen.

CREATE TABLE public.special_leave_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  default_duration_days integer not null,
  requires_document boolean not null default true,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

ALTER TABLE public.special_leave_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active types visible to all, all types visible to admin/hr"
  ON public.special_leave_types FOR SELECT
  TO authenticated
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'hr'::app_role));

CREATE POLICY "Admin/HR can insert special leave types"
  ON public.special_leave_types FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'hr'::app_role));

CREATE POLICY "Admin/HR can update special leave types"
  ON public.special_leave_types FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'hr'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'hr'::app_role));

CREATE POLICY "Admin/HR can delete special leave types"
  ON public.special_leave_types FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'hr'::app_role));

CREATE TRIGGER update_special_leave_types_updated_at
BEFORE UPDATE ON public.special_leave_types
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default: durasi mengikuti standar UU Ketenagakerjaan Pasal 93 ayat 4,
-- HR bisa ubah dari halaman Settings tanpa perlu ubah kode.
INSERT INTO public.special_leave_types (code, name, default_duration_days, requires_document, display_order) VALUES
  ('marriage_self', 'Pernikahan Karyawan', 3, true, 1),
  ('marriage_child', 'Pernikahan Anak Karyawan', 2, true, 2),
  ('circumcision_baptism', 'Khitanan/Baptis Anak Karyawan', 2, true, 3),
  ('wife_childbirth', 'Istri Melahirkan/Keguguran', 2, true, 4),
  ('family_death', 'Suami/Istri/Orang Tua/Mertua/Anak/Menantu Meninggal', 2, true, 5),
  ('housemate_death', 'Anggota Keluarga dalam Satu Rumah Meninggal', 1, true, 6);

ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS special_leave_type_id uuid REFERENCES public.special_leave_types(id);
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS attachment_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('leave-attachments', 'leave-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload their own leave attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'leave-attachments' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Owner and admin/hr can view leave attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'leave-attachments' AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'hr'::app_role)
  )
);
