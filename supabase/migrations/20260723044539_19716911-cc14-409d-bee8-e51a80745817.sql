
CREATE POLICY "training-cert: owner select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'training-certificates'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'hr'::public.app_role)
    )
  );

CREATE POLICY "training-cert: owner insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'training-certificates'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'hr'::public.app_role)
    )
  );

CREATE POLICY "training-cert: owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'training-certificates'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'hr'::public.app_role)
    )
  );

CREATE POLICY "training-cert: owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'training-certificates'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'hr'::public.app_role)
    )
  );
