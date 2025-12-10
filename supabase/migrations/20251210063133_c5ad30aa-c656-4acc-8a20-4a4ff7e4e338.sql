-- Allow employees to upload their own photos (using their user id as folder name)
CREATE POLICY "Users can upload their own photo"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'employee-photos' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow employees to update their own photos
CREATE POLICY "Users can update their own photo"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'employee-photos' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow employees to delete their own photos
CREATE POLICY "Users can delete their own photo"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'employee-photos' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);