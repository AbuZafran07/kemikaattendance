-- Make employee-photos bucket private
UPDATE storage.buckets SET public = false WHERE id = 'employee-photos';

-- Drop all existing storage policies for employee-photos
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload employee photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update employee photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view employee photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view employee photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete employee photos" ON storage.objects;

-- Create new policies for private bucket
CREATE POLICY "Authenticated users can view employee photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'employee-photos');

CREATE POLICY "Authenticated users can upload employee photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'employee-photos');

CREATE POLICY "Authenticated users can update employee photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'employee-photos');

CREATE POLICY "Admins can delete employee photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'employee-photos' AND EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_id = auth.uid() AND role = 'admin'
));