-- Fix 1: Add constraints to attendance table for base64 photo validation
-- Add size constraint to limit photo data URLs to ~5MB (base64 is ~33% larger than binary)
ALTER TABLE public.attendance 
ADD CONSTRAINT check_photo_size 
CHECK (
  (check_in_photo_url IS NULL OR length(check_in_photo_url) <= 7000000) AND
  (check_out_photo_url IS NULL OR length(check_out_photo_url) <= 7000000)
);

-- Add format validation to ensure only valid image data URLs are accepted
ALTER TABLE public.attendance
ADD CONSTRAINT check_photo_format
CHECK (
  (check_in_photo_url IS NULL OR check_in_photo_url ~* '^data:image/(jpeg|png|webp);base64,') AND
  (check_out_photo_url IS NULL OR check_out_photo_url ~* '^data:image/(jpeg|png|webp);base64,')
);

-- Fix 2: Drop overly permissive storage policies for employee-photos bucket
DROP POLICY IF EXISTS "Authenticated users can view employee photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload employee photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update employee photos" ON storage.objects;

-- Add properly scoped view policies
-- Admins can view all employee photos
CREATE POLICY "Admins can view all employee photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'employee-photos' AND 
  has_role(auth.uid(), 'admin'::app_role)
);

-- Users can view their own photos only
CREATE POLICY "Users can view their own photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'employee-photos' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);