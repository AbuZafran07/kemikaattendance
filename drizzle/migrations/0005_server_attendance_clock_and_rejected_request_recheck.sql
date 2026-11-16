CREATE OR REPLACE FUNCTION public.get_work_hours_for_date(p_date date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE normal jsonb; special jsonb; period jsonb; result jsonb;
BEGIN
 SELECT value INTO normal FROM public.system_settings WHERE key='work_hours';
 SELECT value INTO special FROM public.system_settings WHERE key='special_work_hours';
 FOR period IN SELECT * FROM jsonb_array_elements(COALESCE(special->'periods','[]'::jsonb)) LOOP
  IF COALESCE((period->>'is_active')::boolean,false) AND p_date BETWEEN (period->>'start_date')::date AND (period->>'end_date')::date THEN
   RETURN jsonb_build_object('check_in_start',COALESCE(period->>'check_in_start',normal->>'check_in_start'),'check_in_end',COALESCE(period->>'check_in_end',normal->>'check_in_end'),'check_out_start',COALESCE(period->>'check_out_start',normal->>'check_out_start'),'check_out_end',COALESCE(period->>'check_out_end',normal->>'check_out_end'),'late_tolerance_minutes',COALESCE((period->>'late_tolerance_minutes')::integer,(normal->>'late_tolerance_minutes')::integer,15),'early_leave_tolerance_minutes',COALESCE((period->>'early_leave_tolerance_minutes')::integer,(normal->>'early_leave_tolerance_minutes')::integer,15),'special_period_name',period->>'name');
  END IF;
 END LOOP;
 result:=COALESCE(normal,'{}'::jsonb);
 IF extract(dow FROM p_date)=5 AND COALESCE((result->>'friday_enabled')::boolean,false) THEN
  result:=result || jsonb_build_object('check_out_start',COALESCE(result->>'friday_check_out_start',result->>'check_out_start'),'check_out_end',COALESCE(result->>'friday_check_out_end',result->>'check_out_end'),'early_leave_tolerance_minutes',COALESCE((result->>'friday_early_leave_tolerance_minutes')::integer,(result->>'early_leave_tolerance_minutes')::integer,15),'is_friday_schedule',true);
 END IF;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.get_work_hours_for_date(date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_work_hours_for_date(date) TO service_role;
CREATE OR REPLACE FUNCTION public.get_effective_work_hours() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT public.get_work_hours_for_date((now() AT TIME ZONE 'Asia/Jakarta')::date); $$;

CREATE OR REPLACE FUNCTION public.enforce_employee_attendance_clock() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE server_now timestamptz:=clock_timestamp(); local_now timestamp; wh jsonb; minutes_now integer; deadline integer; actor uuid:=auth.uid();
BEGIN
 IF auth.role()='service_role' OR public.has_role(actor,'admin'::public.app_role) THEN RETURN NEW; END IF;
 IF actor IS NULL OR NEW.user_id IS DISTINCT FROM actor THEN RAISE EXCEPTION 'Not authorized'; END IF;
 IF TG_OP='UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN RAISE EXCEPTION 'Attendance owner cannot change'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=actor AND status='Active' AND account_status<>'locked' AND departemen NOT IN ('BOD','Komisaris')) THEN RAISE EXCEPTION 'Attendance is unavailable for this account'; END IF;
 local_now:=server_now AT TIME ZONE 'Asia/Jakarta';
 wh:=public.get_work_hours_for_date(local_now::date);
 minutes_now:=extract(hour FROM local_now)::integer*60+extract(minute FROM local_now)::integer;
 IF TG_OP='INSERT' THEN
  NEW.check_in_time:=server_now; NEW.created_at:=server_now; NEW.check_out_time:=NULL; NEW.duration_minutes:=NULL;
  deadline:=extract(hour FROM COALESCE(wh->>'check_in_end','09:00')::time)::integer*60+extract(minute FROM COALESCE(wh->>'check_in_end','09:00')::time)::integer+COALESCE((wh->>'late_tolerance_minutes')::integer,15);
  NEW.late_minutes:=GREATEST(0,minutes_now-deadline);
  NEW.status:=CASE WHEN NEW.late_minutes>0 THEN 'terlambat'::public.attendance_status ELSE 'hadir'::public.attendance_status END;
 ELSE
  NEW.check_in_time:=OLD.check_in_time; NEW.created_at:=OLD.created_at; NEW.late_minutes:=OLD.late_minutes; NEW.status:=OLD.status; NEW.duration_minutes:=OLD.duration_minutes;
  IF OLD.check_out_time IS NULL AND NEW.check_out_time IS NOT NULL THEN
   NEW.check_out_time:=server_now;
   NEW.duration_minutes:=GREATEST(0,floor(extract(epoch FROM (server_now-OLD.check_in_time))/60)::integer);
   deadline:=extract(hour FROM COALESCE(wh->>'check_out_start','17:00')::time)::integer*60+extract(minute FROM COALESCE(wh->>'check_out_start','17:00')::time)::integer-COALESCE((wh->>'early_leave_tolerance_minutes')::integer,15);
   IF minutes_now<deadline THEN NEW.status:='pulang_cepat'; END IF;
  ELSE NEW.check_out_time:=OLD.check_out_time; END IF;
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.enforce_employee_attendance_clock() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER enforce_employee_attendance_clock BEFORE INSERT OR UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.enforce_employee_attendance_clock();

CREATE OR REPLACE FUNCTION public.recheck_rejected_attendance_request() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d date; local_now timestamp:=clock_timestamp() AT TIME ZONE 'Asia/Jakarta'; wh jsonb; holidays jsonb; p public.profiles;
BEGIN
 IF NEW.status<>'rejected' OR OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
 IF NOT public.is_discipline_admin() THEN RAISE EXCEPTION 'Only admin/HR can reject requests'; END IF;
 SELECT * INTO p FROM public.profiles WHERE id=NEW.user_id;
 IF p.id IS NULL OR p.status IS DISTINCT FROM 'Active' OR p.departemen IN ('BOD','Komisaris') OR public.has_role(p.id,'admin'::public.app_role) THEN RETURN NEW; END IF;
 SELECT COALESCE(value->'holidays','[]'::jsonb) INTO holidays FROM public.system_settings WHERE key='overtime_policy';
 d:=GREATEST(NEW.start_date,p.join_date);
 WHILE d<=LEAST(NEW.end_date,local_now::date,COALESCE(p.resign_date,NEW.end_date)) LOOP
  wh:=public.get_work_hours_for_date(d);
  IF extract(dow FROM d) NOT IN (0,6)
   AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(holidays,'[]'::jsonb)) h WHERE h->>'date'=d::text)
   AND (d<local_now::date OR local_now::time>=COALESCE(wh->>'check_out_end','17:00')::time)
   AND NOT EXISTS(SELECT 1 FROM public.attendance a WHERE a.user_id=NEW.user_id AND a.check_in_time>=d::timestamp AT TIME ZONE 'Asia/Jakarta' AND a.check_in_time<(d+1)::timestamp AT TIME ZONE 'Asia/Jakarta')
   AND NOT EXISTS(SELECT 1 FROM public.leave_requests r WHERE r.user_id=NEW.user_id AND d BETWEEN r.start_date AND r.end_date AND r.status IN ('pending','approved'))
   AND NOT EXISTS(SELECT 1 FROM public.business_travel_requests r WHERE r.user_id=NEW.user_id AND d BETWEEN r.start_date AND r.end_date AND r.status IN ('pending','approved')) THEN
    PERFORM public.create_attendance_violation(NEW.user_id,NULL,d,'absent_without_permission','Tidak hadir pada hari kerja; pengajuan izin/cuti/dinas ditolak HR.','hr',NULL);
  END IF;
  d:=d+1;
 END LOOP;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.recheck_rejected_attendance_request() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER recheck_rejected_leave_attendance AFTER UPDATE OF status ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.recheck_rejected_attendance_request();
CREATE TRIGGER recheck_rejected_travel_attendance AFTER UPDATE OF status ON public.business_travel_requests FOR EACH ROW EXECUTE FUNCTION public.recheck_rejected_attendance_request();