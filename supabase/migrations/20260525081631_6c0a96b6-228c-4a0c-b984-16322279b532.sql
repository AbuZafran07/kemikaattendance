
-- 1) Batasi SELECT kpi_grade_settings ke Admin & HR saja
DROP POLICY IF EXISTS "Authenticated can view kpi_grade_settings" ON public.kpi_grade_settings;

CREATE POLICY "HR can view kpi_grade_settings"
ON public.kpi_grade_settings
FOR SELECT
USING (public.has_role(auth.uid(), 'hr'::public.app_role));

-- 2) HR bisa lihat foto attendance di storage
CREATE POLICY "HR can view all attendance photos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'attendance-photos'
  AND public.has_role(auth.uid(), 'hr'::public.app_role)
);
