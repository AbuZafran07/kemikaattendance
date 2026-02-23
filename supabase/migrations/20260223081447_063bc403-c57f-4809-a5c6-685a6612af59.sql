-- Allow authenticated employees to read calendar-related settings
CREATE POLICY "Employees can view calendar settings"
ON public.system_settings
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND key IN ('overtime_policy', 'special_work_hours')
);
