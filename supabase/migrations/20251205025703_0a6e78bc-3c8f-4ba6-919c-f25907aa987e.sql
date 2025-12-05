-- Remove the public access policy that allows anyone to view employee photos
DROP POLICY IF EXISTS "Employee photos are publicly accessible" ON storage.objects;