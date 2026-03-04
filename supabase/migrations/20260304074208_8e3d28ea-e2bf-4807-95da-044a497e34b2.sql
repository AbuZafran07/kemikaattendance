-- Drop overly permissive policies on employee-photos bucket
DROP POLICY IF EXISTS "Authenticated users can upload employee photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update employee photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete employee photos" ON storage.objects;

-- Admins can manage all employee photos (upload, update, delete)
CREATE POLICY "Admins can manage all employee photos"
ON storage.objects FOR ALL
USING (
  bucket_id = 'employee-photos' AND
  public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  bucket_id = 'employee-photos' AND
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Users can upload photos to their own folder only
CREATE POLICY "Users can upload own employee photo"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'employee-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can update their own photos only
CREATE POLICY "Users can update own employee photo"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'employee-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can delete their own photos only
CREATE POLICY "Users can delete own employee photo"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'employee-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Keep existing SELECT policy for all authenticated users
-- (viewing photos is needed for avatars across the app)