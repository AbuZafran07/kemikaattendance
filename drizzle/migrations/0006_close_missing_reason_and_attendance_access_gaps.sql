CREATE OR REPLACE FUNCTION public.enforce_employee_attendance_clock() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE server_now timestamptz:=clock_timestamp(); local_now timestamp; wh jsonb; minutes_now integer; deadline integer; actor uuid:=auth.uid();
BEGIN
 IF auth.role()='service_role' OR public.is_discipline_admin() THEN RETURN NEW; END IF;
 IF actor IS NULL OR NEW.user_id IS DISTINCT FROM actor THEN RAISE EXCEPTION 'Not authorized'; END IF;
 IF TG_OP='UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN RAISE EXCEPTION 'Attendance owner cannot change'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=actor AND status='Active' AND (TG_OP='UPDATE' OR account_status<>'locked') AND COALESCE(departemen,'') NOT IN ('BOD','Komisaris')) THEN RAISE EXCEPTION 'Attendance is unavailable for this account'; END IF;
 local_now:=server_now AT TIME ZONE 'Asia/Jakarta'; wh:=public.get_work_hours_for_date(local_now::date); minutes_now:=extract(hour FROM local_now)::integer*60+extract(minute FROM local_now)::integer;
 IF TG_OP='INSERT' THEN
 NEW.check_in_time:=server_now; NEW.created_at:=server_now; NEW.check_out_time:=NULL; NEW.duration_minutes:=NULL;
 deadline:=extract(hour FROM COALESCE(wh->>'check_in_end','09:00')::time)::integer*60+extract(minute FROM COALESCE(wh->>'check_in_end','09:00')::time)::integer+COALESCE((wh->>'late_tolerance_minutes')::integer,15);
 NEW.late_minutes:=GREATEST(0,minutes_now-deadline); NEW.status:=CASE WHEN NEW.late_minutes>0 THEN 'terlambat'::public.attendance_status ELSE 'hadir'::public.attendance_status END;
 ELSE
 NEW.check_in_time:=OLD.check_in_time; NEW.created_at:=OLD.created_at; NEW.late_minutes:=OLD.late_minutes; NEW.status:=OLD.status; NEW.duration_minutes:=OLD.duration_minutes;
 IF OLD.check_out_time IS NULL AND NEW.check_out_time IS NOT NULL THEN
 NEW.check_out_time:=server_now; NEW.duration_minutes:=GREATEST(0,floor(extract(epoch FROM (server_now-OLD.check_in_time))/60)::integer);
 deadline:=extract(hour FROM COALESCE(wh->>'check_out_start','17:00')::time)::integer*60+extract(minute FROM COALESCE(wh->>'check_out_start','17:00')::time)::integer-COALESCE((wh->>'early_leave_tolerance_minutes')::integer,15);
 IF minutes_now<deadline THEN NEW.status:='pulang_cepat'; END IF;
 ELSE NEW.check_out_time:=OLD.check_out_time; END IF;
 END IF; RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION public.submit_late_reason(p_attendance_id uuid,p_reason text,p_description text DEFAULT NULL,p_attachment_url text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_attendance public.attendance; v_id uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF p_reason IS NULL OR length(trim(p_reason))=0 THEN RAISE EXCEPTION 'Reason is required'; END IF;
 IF length(p_reason)>500 THEN RAISE EXCEPTION 'Reason must be 500 characters or less'; END IF;
 p_reason:=regexp_replace(p_reason,E'[\\x00-\\x1F\\x7F]','','g');
 SELECT * INTO v_attendance FROM public.attendance WHERE id=p_attendance_id FOR UPDATE;
 IF v_attendance.id IS NULL THEN RAISE EXCEPTION 'Attendance record not found'; END IF;
 IF v_attendance.user_id!=auth.uid() THEN RAISE EXCEPTION 'Not authorized'; END IF;
 IF v_attendance.status!='terlambat' AND COALESCE(v_attendance.late_minutes,0)<=0 THEN RAISE EXCEPTION 'Late reason can only be submitted for late attendance'; END IF;
 IF EXISTS(SELECT 1 FROM public.late_reasons WHERE attendance_id=p_attendance_id) THEN RAISE EXCEPTION 'A late reason has already been submitted for this attendance record'; END IF;
 INSERT INTO public.late_reasons(attendance_id,user_id,reason,description,attachment_url) VALUES(p_attendance_id,auth.uid(),p_reason,p_description,p_attachment_url) RETURNING id INTO v_id;
 INSERT INTO public.attendance_notifications(user_id,notif_type,title,message,related_id,target_role) SELECT ur.user_id,'late_reason_pending','Alasan Keterlambatan Baru','Ada alasan keterlambatan baru menunggu persetujuan HR.',v_id,'hr' FROM public.user_roles ur WHERE ur.role IN ('admin','hr');
 RETURN v_id;
END; $$;
CREATE OR REPLACE FUNCTION public.reconcile_attendance_discipline(p_user_id uuid,p_month date,p_attendance_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE cfg jsonb:=public.get_attendance_discipline_config(); n integer; r record;
BEGIN
 IF NOT public.is_discipline_admin() AND auth.uid() IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION 'Not authorized'; END IF;
 n:=public.get_monthly_violation_count(p_user_id,p_month);
 FOR r IN SELECT * FROM public.disciplinary_actions WHERE user_id=p_user_id AND period_month=date_trunc('month',p_month)::date AND status='active' AND n<CASE warning_type WHEN 'sp2' THEN COALESCE((cfg->>'sp2_threshold')::integer,8) ELSE COALESCE((cfg->>'sp1_threshold')::integer,5) END FOR UPDATE LOOP
 UPDATE public.disciplinary_actions SET status='superseded' WHERE id=r.id;
 INSERT INTO public.attendance_audit_logs(attendance_id,action_type,changed_by,old_data,new_data,reason) VALUES(p_attendance_id,'discipline_reconciled',COALESCE(auth.uid(),p_user_id),to_jsonb(r),jsonb_build_object('status','superseded','monthly_violations',n),'SP dinonaktifkan setelah koreksi pelanggaran; riwayat dipertahankan.');
 INSERT INTO public.attendance_notifications(user_id,notif_type,title,message,related_id,target_role) VALUES(p_user_id,'warning_corrected','Surat Peringatan Dikoreksi','SP dinonaktifkan setelah penghitungan ulang pelanggaran absensi.',r.id,'employee');
 END LOOP;
 FOR r IN SELECT * FROM public.account_locks WHERE user_id=p_user_id AND status='locked' AND date_trunc('month',locked_at AT TIME ZONE 'Asia/Jakarta')::date=date_trunc('month',p_month)::date AND reason LIKE 'Akun dikunci otomatis karena mencapai %' AND n<COALESCE((cfg->>'lock_threshold')::integer,11) FOR UPDATE LOOP
 UPDATE public.account_locks SET status='unlocked',unlocked_at=now(),unlocked_by=auth.uid() WHERE id=r.id;
 IF NOT EXISTS(SELECT 1 FROM public.account_locks WHERE user_id=p_user_id AND status='locked') THEN UPDATE public.profiles SET account_status='active' WHERE id=p_user_id; END IF;
 INSERT INTO public.attendance_audit_logs(attendance_id,action_type,changed_by,old_data,new_data,reason) VALUES(p_attendance_id,'discipline_reconciled',COALESCE(auth.uid(),p_user_id),to_jsonb(r),jsonb_build_object('status','unlocked','monthly_violations',n),'Kunci otomatis dicabut setelah koreksi pelanggaran.');
 INSERT INTO public.attendance_notifications(user_id,notif_type,title,message,related_id,target_role) VALUES(p_user_id,'account_unlocked','Kunci Akun Dikoreksi','Kunci otomatis dicabut setelah penghitungan ulang pelanggaran absensi.',r.id,'employee');
 END LOOP;
END; $$;
REVOKE ALL ON FUNCTION public.reconcile_attendance_discipline(uuid,date,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_attendance_discipline(uuid,date,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.reconcile_submitted_late_reason() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r record;
BEGIN
 IF NEW.status NOT IN ('pending','approved') OR length(trim(NEW.reason))=0 THEN RETURN NEW; END IF;
 FOR r IN SELECT * FROM public.attendance_violations WHERE attendance_id=NEW.attendance_id AND is_counted AND violation_type IN ('late','late_no_reason_submitted','late_reason_rejected') FOR UPDATE LOOP
 UPDATE public.attendance_violations SET is_counted=false,late_reason_id=NEW.id WHERE id=r.id;
 INSERT INTO public.attendance_audit_logs(attendance_id,action_type,changed_by,old_data,new_data,reason) VALUES(NEW.attendance_id,'attendance_violation_recalculated',COALESCE(auth.uid(),NEW.user_id),to_jsonb(r),jsonb_build_object('is_counted',false),'Alasan terkirim menunggu HR atau disetujui; pelanggaran dinonaktifkan.');
 PERFORM public.reconcile_attendance_discipline(NEW.user_id,r.violation_date,NEW.attendance_id);
 END LOOP; RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.reconcile_submitted_late_reason() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER reconcile_submitted_reason AFTER INSERT OR UPDATE OF status ON public.late_reasons FOR EACH ROW EXECUTE FUNCTION public.reconcile_submitted_late_reason();
CREATE OR REPLACE FUNCTION public.scan_missing_late_reasons() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a record; total integer:=0;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Not authorized'; END IF;
 FOR a IN SELECT at.* FROM public.attendance at JOIN public.profiles p ON p.id=at.user_id WHERE (at.status='terlambat' OR COALESCE(at.late_minutes,0)>0) AND at.check_in_time<=clock_timestamp()-interval '24 hours' AND p.status='Active' AND COALESCE(p.departemen,'') NOT IN ('BOD','Komisaris') AND NOT public.has_role(p.id,'admin'::public.app_role) AND NOT EXISTS(SELECT 1 FROM public.late_reasons lr WHERE lr.attendance_id=at.id) AND NOT EXISTS(SELECT 1 FROM public.attendance_violations v WHERE v.user_id=at.user_id AND v.violation_date=(at.check_in_time AT TIME ZONE 'Asia/Jakarta')::date AND v.is_counted) ORDER BY at.check_in_time FOR UPDATE OF at LOOP
 IF EXISTS(SELECT 1 FROM public.late_reasons WHERE attendance_id=a.id) THEN CONTINUE; END IF;
 PERFORM public.create_attendance_violation(a.user_id,a.id,(a.check_in_time AT TIME ZONE 'Asia/Jakarta')::date,'late_no_reason_submitted','Alasan keterlambatan belum dikirim dalam 24 jam setelah check-in.','system',NULL); total:=total+1;
 END LOOP; RETURN total;
END; $$;
REVOKE ALL ON FUNCTION public.scan_missing_late_reasons() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.scan_missing_late_reasons() TO service_role;