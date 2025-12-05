-- Remove duplicate overly-permissive storage policies
DROP POLICY IF EXISTS "Authenticated users can delete employee photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload employee photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update employee photos" ON storage.objects;