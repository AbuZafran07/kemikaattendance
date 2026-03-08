
-- Create backups storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('backups', 'backups', false)
ON CONFLICT (id) DO NOTHING;

-- Only admins can upload backups
CREATE POLICY "Admins can upload backups"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'backups' AND
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Only admins can read backups
CREATE POLICY "Admins can read backups"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'backups' AND
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Only admins can delete backups
CREATE POLICY "Admins can delete backups"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'backups' AND
  public.has_role(auth.uid(), 'admin'::public.app_role)
);
