
CREATE POLICY "Users can upload own business travel documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'business-travel-docs' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own business travel documents"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'business-travel-docs' AND (auth.uid())::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'business-travel-docs' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own business travel documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'business-travel-docs' AND (auth.uid())::text = (storage.foldername(name))[1]);
