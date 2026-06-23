DROP POLICY IF EXISTS "Employees can view calendar settings" ON public.system_settings;

CREATE POLICY "Employees can view shared settings"
ON public.system_settings
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND key = ANY (ARRAY['overtime_policy','special_work_hours','leave_policy'])
);