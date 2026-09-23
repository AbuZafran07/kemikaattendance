-- 1. payroll_periods: employees only see periods where they have a payroll row
DROP POLICY IF EXISTS "Employees can view payroll periods" ON public.payroll_periods;
CREATE POLICY "Employees can view own payroll periods"
ON public.payroll_periods
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.payroll p
    WHERE p.period_id = payroll_periods.id
      AND p.user_id = auth.uid()
  )
);

-- 2. company_events: only active employees
DROP POLICY IF EXISTS "Anyone authenticated can view events" ON public.company_events;
CREATE POLICY "Active employees can view events"
ON public.company_events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.id = auth.uid()
      AND COALESCE(pr.status, 'Active') NOT IN ('Inactive', 'Resigned')
  )
);

-- 3. kpi_grade_settings: only active employees
DROP POLICY IF EXISTS "Authenticated users can view KPI grade settings" ON public.kpi_grade_settings;
CREATE POLICY "Active employees can view KPI grade settings"
ON public.kpi_grade_settings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.id = auth.uid()
      AND COALESCE(pr.status, 'Active') NOT IN ('Inactive', 'Resigned')
  )
);

-- 4. geocoding_cache: restrict the manage policy to service_role only
DROP POLICY IF EXISTS "Service role can manage geocoding cache" ON public.geocoding_cache;
CREATE POLICY "Service role can manage geocoding cache"
ON public.geocoding_cache
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 5. training_programs: active employees see active programs; admin/HR see all
DROP POLICY IF EXISTS "All authenticated can view training programs" ON public.training_programs;
CREATE POLICY "Active employees can view active training programs"
ON public.training_programs
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'hr'::app_role)
  OR (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = auth.uid()
        AND COALESCE(pr.status, 'Active') NOT IN ('Inactive', 'Resigned')
    )
  )
);