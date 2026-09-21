
DROP POLICY IF EXISTS "Anyone can view active announcements" ON public.company_announcements;

CREATE POLICY "Authenticated users can view active announcements"
ON public.company_announcements
FOR SELECT
TO authenticated
USING (is_active = true);

-- Revoke EXECUTE from anon on SECURITY DEFINER functions exposed via API
REVOKE EXECUTE ON FUNCTION public.get_biaya_jabatan_config() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_bpjs_config() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_ptkp_config() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_pph21_brackets_config() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_delegation_colleagues() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.mark_notifications_seen() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_office_locations() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_work_hours() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.reject_leave_request(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.approve_leave_request(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.approve_overtime_request(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.approve_business_travel_request(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.reject_business_travel_request(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.reject_overtime_request(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_low_leave_quota_employees(integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_effective_work_hours() FROM anon, public;

GRANT EXECUTE ON FUNCTION public.get_biaya_jabatan_config() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_bpjs_config() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ptkp_config() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pph21_brackets_config() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_delegation_colleagues() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notifications_seen() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_office_locations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_work_hours() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_leave_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_leave_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_overtime_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_business_travel_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_business_travel_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_overtime_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_low_leave_quota_employees(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_effective_work_hours() TO authenticated;
