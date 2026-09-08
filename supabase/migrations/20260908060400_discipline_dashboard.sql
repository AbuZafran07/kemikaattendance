-- ============================================================
-- ATTENDANCE DISCIPLINE: DASHBOARD AGGREGATES (Fase 5)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_attendance_discipline_dashboard_stats(p_month date DEFAULT CURRENT_DATE)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_month_start date := date_trunc('month', p_month)::date;
  result jsonb;
BEGIN
  IF NOT public.is_discipline_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT jsonb_build_object(
    'total_employees', (
      SELECT count(*) FROM public.profiles p
      WHERE p.status = 'Active'
        AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role = 'admin')
    ),
    'total_late', (
      SELECT count(*) FROM public.attendance a
      WHERE a.status = 'terlambat' AND date_trunc('month', a.check_in_time) = v_month_start
    ),
    'approved_late', (
      SELECT count(*) FROM public.late_reasons lr
      JOIN public.attendance a ON a.id = lr.attendance_id
      WHERE lr.status = 'approved' AND date_trunc('month', a.check_in_time) = v_month_start
    ),
    'monthly_violations', (
      SELECT count(*) FROM public.attendance_violations v
      WHERE v.is_counted = true AND date_trunc('month', v.violation_date) = v_month_start
    ),
    'rolling_violations', (
      SELECT count(*) FROM public.attendance_violations v
      WHERE v.is_counted = true
        AND v.violation_date >= (v_month_start - interval '2 months')::date
        AND v.violation_date < (v_month_start + interval '1 month')::date
    ),
    'employees_sp1', (
      SELECT count(DISTINCT user_id) FROM public.disciplinary_actions
      WHERE warning_type = 'sp1' AND period_month = v_month_start
    ),
    'employees_sp2', (
      SELECT count(DISTINCT user_id) FROM public.disciplinary_actions
      WHERE warning_type = 'sp2' AND period_month = v_month_start
    ),
    'employees_early_warning', (
      SELECT count(DISTINCT user_id) FROM public.attendance_notifications
      WHERE notif_type = 'rolling_3month_warning' AND target_role = 'employee'
        AND date_trunc('month', created_at)::date = v_month_start
    ),
    'locked_accounts', (
      SELECT count(*) FROM public.account_locks WHERE status = 'locked'
    )
  ) INTO result;

  RETURN result;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_attendance_discipline_dashboard_stats(date) FROM anon;

CREATE OR REPLACE FUNCTION public.get_attendance_discipline_employee_rows(p_month date DEFAULT CURRENT_DATE)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  departemen text,
  account_status text,
  monthly_violations integer,
  rolling_violations integer,
  warning_level text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_month_start date := date_trunc('month', p_month)::date;
BEGIN
  IF NOT public.is_discipline_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.departemen,
    p.account_status,
    COALESCE((
      SELECT count(*)::integer FROM public.attendance_violations v
      WHERE v.user_id = p.id AND v.is_counted = true
        AND date_trunc('month', v.violation_date) = v_month_start
    ), 0),
    COALESCE((
      SELECT count(*)::integer FROM public.attendance_violations v
      WHERE v.user_id = p.id AND v.is_counted = true
        AND v.violation_date >= (v_month_start - interval '2 months')::date
        AND v.violation_date < (v_month_start + interval '1 month')::date
    ), 0),
    (
      SELECT da.warning_type FROM public.disciplinary_actions da
      WHERE da.user_id = p.id AND da.period_month = v_month_start
      ORDER BY CASE da.warning_type WHEN 'sp2' THEN 2 ELSE 1 END DESC LIMIT 1
    )
  FROM public.profiles p
  WHERE p.status = 'Active'
    AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role = 'admin')
  ORDER BY p.full_name;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_attendance_discipline_employee_rows(date) FROM anon;
