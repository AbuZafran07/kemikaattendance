-- Create storage bucket for employee photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-photos', 'employee-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Create policy for public read access
CREATE POLICY "Employee photos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'employee-photos');

-- Create policy for authenticated users to upload
CREATE POLICY "Authenticated users can upload employee photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'employee-photos' AND auth.role() = 'authenticated');

-- Create policy for authenticated users to update
CREATE POLICY "Authenticated users can update employee photos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'employee-photos' AND auth.role() = 'authenticated');

-- Create policy for authenticated users to delete
CREATE POLICY "Authenticated users can delete employee photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'employee-photos' AND auth.role() = 'authenticated');