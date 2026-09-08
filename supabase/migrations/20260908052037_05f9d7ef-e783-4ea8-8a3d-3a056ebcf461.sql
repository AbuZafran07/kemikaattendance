CREATE POLICY "Admin HR manage unlock letters" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'unlock-letters' AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'hr'::app_role)))
  WITH CHECK (bucket_id = 'unlock-letters' AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'hr'::app_role)));

CREATE POLICY "Users view own unlock letters" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'unlock-letters' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users upload own unlock letters" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'unlock-letters' AND (storage.foldername(name))[1] = auth.uid()::text);