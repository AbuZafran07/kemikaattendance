CREATE OR REPLACE FUNCTION public.scan_missing_late_reasons()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE a record; total integer:=0;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Not authorized'; END IF;
 FOR a IN
   SELECT at.* FROM public.attendance at
   JOIN public.profiles p ON p.id=at.user_id
   WHERE (at.status='terlambat' OR COALESCE(at.late_minutes,0)>0)
     AND at.check_in_time+make_interval(hours=>public.late_reason_deadline_hours())<clock_timestamp()
     AND p.status='Active'
     AND COALESCE(p.departemen,'') NOT IN ('BOD','Komisaris')
     AND NOT public.has_role(p.id,'admin'::public.app_role)
     AND NOT EXISTS(SELECT 1 FROM public.late_reasons lr WHERE lr.attendance_id=at.id)
     AND NOT EXISTS(SELECT 1 FROM public.attendance_violations v WHERE v.attendance_id=at.id)
     AND NOT EXISTS(SELECT 1 FROM public.attendance_violations v WHERE v.user_id=at.user_id AND v.violation_date=(at.check_in_time AT TIME ZONE 'Asia/Jakarta')::date AND v.is_counted)
   ORDER BY at.check_in_time FOR UPDATE OF at
 LOOP
   IF EXISTS(SELECT 1 FROM public.late_reasons WHERE attendance_id=a.id)
      OR EXISTS(SELECT 1 FROM public.attendance_violations v WHERE v.attendance_id=a.id)
      OR EXISTS(SELECT 1 FROM public.attendance_violations v WHERE v.user_id=a.user_id AND v.violation_date=(a.check_in_time AT TIME ZONE 'Asia/Jakarta')::date AND v.is_counted)
   THEN CONTINUE; END IF;
   PERFORM public.create_attendance_violation(a.user_id,a.id,(a.check_in_time AT TIME ZONE 'Asia/Jakarta')::date,'late_no_reason_submitted',format('Alasan keterlambatan belum dikirim dalam %s jam setelah check-in.',public.late_reason_deadline_hours()),'system',NULL);
   total:=total+1;
 END LOOP;
 RETURN total;
END;
$function$;
REVOKE ALL ON FUNCTION public.scan_missing_late_reasons() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.scan_missing_late_reasons() TO service_role;