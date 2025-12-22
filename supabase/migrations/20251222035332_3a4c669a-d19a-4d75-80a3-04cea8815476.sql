-- Create storage bucket for attendance photos (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('attendance-photos', 'attendance-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can upload their own attendance photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own attendance photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all attendance photos" ON storage.objects;

-- Users can upload their own attendance photos (organized by user_id/date/type)
CREATE POLICY "Users can upload their own attendance photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'attendance-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can view their own attendance photos
CREATE POLICY "Users can view their own attendance photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'attendance-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Admins can view all attendance photos
CREATE POLICY "Admins can view all attendance photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'attendance-photos' AND
  has_role(auth.uid(), 'admin'::app_role)
);

-- Remove the base64 constraints that were added before
-- These are blocking us from storing URLs now
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS check_photo_format;
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS check_photo_size;

-- Clear existing base64 photo data to allow migration to storage
-- This is necessary because old data contains large base64 strings
UPDATE public.attendance SET check_in_photo_url = NULL, check_out_photo_url = NULL 
WHERE check_in_photo_url IS NOT NULL OR check_out_photo_url IS NOT NULL;