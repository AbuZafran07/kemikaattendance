CREATE OR REPLACE FUNCTION public.late_reason_deadline_hours() RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$ SELECT GREATEST(1,COALESCE((public.get_attendance_discipline_config()->>'late_reason_deadline_hours')::integer,24)); $$;
REVOKE ALL ON FUNCTION public.late_reason_deadline_hours() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.late_reason_deadline_hours() TO service_role;
CREATE OR REPLACE FUNCTION public.get_late_reason_window() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$ BEGIN IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF; RETURN jsonb_build_object('deadline_hours',public.late_reason_deadline_hours(),'server_now',clock_timestamp()); END; $$;
REVOKE ALL ON FUNCTION public.get_late_reason_window() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_late_reason_window() TO authenticated;
DO $change$ DECLARE def text; BEGIN
SELECT pg_get_functiondef('public.submit_late_reason(uuid,text,text,text)'::regprocedure) INTO def;
def:=replace(def,'IF EXISTS(SELECT 1 FROM public.late_reasons WHERE attendance_id=p_attendance_id)', 'IF clock_timestamp()>v_attendance.check_in_time+make_interval(hours=>public.late_reason_deadline_hours()) THEN RAISE EXCEPTION ''Batas waktu pengajuan alasan keterlambatan sudah lewat. Silakan hubungi HR.''; END IF; IF EXISTS(SELECT 1 FROM public.late_reasons WHERE attendance_id=p_attendance_id)');
def:=replace(def,'attendance_id,user_id,reason,description,attachment_url) VALUES(p_attendance_id,auth.uid(),p_reason,p_description,p_attachment_url)', 'attendance_id,user_id,reason,description,attachment_url,submitted_at) VALUES(p_attendance_id,auth.uid(),p_reason,p_description,p_attachment_url,clock_timestamp())'); EXECUTE def;
SELECT pg_get_functiondef('public.scan_missing_late_reasons()'::regprocedure) INTO def;
def:=replace(def,'at.check_in_time<=clock_timestamp()-interval ''24 hours''','at.check_in_time+make_interval(hours=>public.late_reason_deadline_hours())<clock_timestamp()');
def:=replace(def,'''Alasan keterlambatan belum dikirim dalam 24 jam setelah check-in.''','format(''Alasan keterlambatan belum dikirim dalam %s jam setelah check-in.'',public.late_reason_deadline_hours())'); EXECUTE def;
SELECT pg_get_functiondef('public.reconcile_submitted_late_reason()'::regprocedure) INTO def;
def:=replace(def,'IF NEW.status NOT IN','IF NOT EXISTS(SELECT 1 FROM public.attendance a WHERE a.id=NEW.attendance_id AND NEW.submitted_at<=a.check_in_time+make_interval(hours=>public.late_reason_deadline_hours())) THEN RETURN NEW; END IF; IF NEW.status NOT IN'); EXECUTE def;
SELECT pg_get_functiondef('public.approve_late_reason(uuid,text)'::regprocedure) INTO def;
def:=replace(def,'WHERE late_reason_id = reason_id AND is_counted = true','WHERE late_reason_id = reason_id AND is_counted = true AND EXISTS (SELECT 1 FROM public.attendance a WHERE a.id=v_row.attendance_id AND v_row.submitted_at<=a.check_in_time+make_interval(hours=>public.late_reason_deadline_hours()))'); EXECUTE def;
END; $change$;
CREATE OR REPLACE FUNCTION public.protect_late_reason_violation_count() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$ BEGIN
 IF NEW.is_counted AND NEW.violation_type IN ('late','late_reason_rejected','late_no_reason_submitted') AND EXISTS (SELECT 1 FROM public.late_reasons lr JOIN public.attendance a ON a.id=lr.attendance_id WHERE (lr.id=NEW.late_reason_id OR lr.attendance_id=NEW.attendance_id) AND length(trim(lr.reason))>0 AND lr.submitted_at<=a.check_in_time+make_interval(hours=>public.late_reason_deadline_hours()) AND lr.status IN ('pending','approved','no_reason_submitted')) THEN NEW.is_counted:=false; END IF; RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.waive_attendance_violation(p_violation_id uuid,p_note text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$ DECLARE v public.attendance_violations; clean_note text; BEGIN
 IF auth.uid() IS NULL OR NOT public.is_discipline_admin() THEN RAISE EXCEPTION 'Only admin/HR can waive violations'; END IF;
 clean_note:=trim(regexp_replace(COALESCE(p_note,''),E'[\\x00-\\x1F\\x7F]','','g'));
 IF length(clean_note)=0 OR length(clean_note)>1000 THEN RAISE EXCEPTION 'Catatan wajib diisi (maksimal 1000 karakter).'; END IF;
 SELECT * INTO v FROM public.attendance_violations WHERE id=p_violation_id FOR UPDATE;
 IF v.id IS NULL THEN RAISE EXCEPTION 'Pelanggaran tidak ditemukan'; END IF; IF NOT v.is_counted THEN RETURN; END IF;
 UPDATE public.attendance_violations SET is_counted=false WHERE id=v.id;
 INSERT INTO public.attendance_audit_logs(attendance_id,action_type,changed_by,old_data,new_data,reason) VALUES(v.attendance_id,'attendance_violation_recalculated',auth.uid(),to_jsonb(v),jsonb_build_object('is_counted',false),clean_note);
 PERFORM public.reconcile_attendance_discipline(v.user_id,v.violation_date,v.attendance_id);
END; $$;
REVOKE ALL ON FUNCTION public.waive_attendance_violation(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.waive_attendance_violation(uuid,text) TO authenticated;
DO $change$ DECLARE def text; typ text; start_at integer; end_at integer; replacement text; BEGIN
SELECT pg_get_functiondef('public.check_attendance_thresholds(uuid,date)'::regprocedure) INTO def;
def:=replace(def,'  v_title text;','  v_old_sp jsonb; v_issued_sp jsonb; v_warning_type text; v_notice record; v_reactivated boolean; v_notify boolean; v_title text;');
FOREACH typ IN ARRAY ARRAY['sp2','sp1'] LOOP
start_at:=strpos(def,'  ELSIF v_monthly >= v_'||typ||' THEN');
end_at:=strpos(substring(def FROM start_at),'      INSERT INTO public.attendance_notifications')+start_at-1;
replacement:=format($r$  ELSIF v_monthly >= v_%1$s THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text||v_month_start::text,0));
    v_sp_id:=NULL;
    SELECT to_jsonb(da) INTO v_old_sp FROM public.disciplinary_actions da WHERE user_id=p_user_id AND warning_type='%1$s' AND period_month=v_month_start FOR UPDATE;
    INSERT INTO public.disciplinary_actions(user_id,warning_type,period_month,violation_count_at_issuance) VALUES(p_user_id,'%1$s',v_month_start,v_monthly)
    ON CONFLICT(user_id,warning_type,period_month) DO UPDATE SET status='active',violation_count_at_issuance=EXCLUDED.violation_count_at_issuance,issue_date=now(),document_url=NULL WHERE disciplinary_actions.status='superseded' RETURNING id INTO v_sp_id;
    IF v_sp_id IS NOT NULL THEN
      IF v_old_sp IS NOT NULL THEN
        INSERT INTO public.attendance_audit_logs(attendance_id,action_type,changed_by,old_data,new_data,reason) VALUES(NULL,'discipline_reconciled',COALESCE(auth.uid(),p_user_id),v_old_sp,jsonb_build_object('status','active','violation_count_at_issuance',v_monthly),'SP diaktifkan kembali setelah jumlah pelanggaran mencapai ambang.');
      END IF;
$r$,typ);
IF start_at=0 OR end_at<start_at THEN RAISE EXCEPTION 'Missing SP branch'; END IF;
def:=substring(def FOR start_at-1)||replacement||substring(def FROM end_at);
END LOOP; EXECUTE def;
END; $change$;