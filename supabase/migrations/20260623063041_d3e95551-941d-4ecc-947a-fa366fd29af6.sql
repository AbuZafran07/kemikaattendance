CREATE POLICY "Authenticated users can view KPI grade settings"
ON public.kpi_grade_settings
FOR SELECT
TO authenticated
USING (true);