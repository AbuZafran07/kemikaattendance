ALTER TABLE public.attendance_notifications ADD COLUMN attendance_date date;
ALTER TABLE public.attendance_notifications ADD COLUMN attendance_id uuid;
ALTER TABLE public.attendance_notifications ADD COLUMN event_key text;
CREATE UNIQUE INDEX attendance_notifications_event_key_unique ON public.attendance_notifications(user_id,event_key) WHERE event_key IS NOT NULL;
ALTER TABLE public.attendance_notifications DROP CONSTRAINT attendance_notifications_notif_type_check;
ALTER TABLE public.attendance_notifications ADD CONSTRAINT attendance_notifications_notif_type_check CHECK (notif_type IN ('late_reason_pending','monthly_violation_progress','sp1_issued','sp2_issued','lock_warning','account_locked','account_unlocked','rolling_3month_warning','unlock_letter_submitted','unlock_letter_approved','unlock_letter_rejected','warning_corrected','late_reason_approved','late_reason_rejected','late_reason_reminder','violation_recorded'));
CREATE OR REPLACE FUNCTION public.notify_late_reason_decision(p_reason_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r record; d date; k text;
BEGIN
 SELECT lr.*,a.check_in_time INTO r FROM public.late_reasons lr JOIN public.attendance a ON a.id=lr.attendance_id WHERE lr.id=p_reason_id;
 IF NOT FOUND OR r.status NOT IN ('approved','rejected') THEN RETURN; END IF;
 d:=(r.check_in_time AT TIME ZONE 'Asia/Jakarta')::date;
 k:='reason:'||r.id::text||':'||r.status;
 INSERT INTO public.attendance_notifications(user_id,notif_type,title,message,related_id,target_role,attendance_date,attendance_id,event_key)
 VALUES(r.user_id,'late_reason_'||r.status,CASE WHEN r.status='approved' THEN 'Alasan Keterlambatan Disetujui' ELSE 'Alasan Keterlambatan Ditolak' END,
 CASE WHEN r.status='approved' THEN format('Alasan keterlambatan tanggal %s disetujui HR dan tidak dihitung sebagai pelanggaran.',d)
 ELSE format('Alasan keterlambatan tanggal %s ditolak HR. Catatan HR: %s. Ini dihitung sebagai pelanggaran.',d,r.rejection_reason) END,
 r.id,'employee',d,r.attendance_id,k) ON CONFLICT(user_id,event_key) WHERE event_key IS NOT NULL DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.notify_late_reason_decision(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.notify_late_reason_decision(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.notify_counted_attendance_violation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE prior uuid[]; n uuid; total integer; threshold integer; label text; detail text; k text;
BEGIN
 IF NOT NEW.is_counted THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text||date_trunc('month',NEW.violation_date)::date::text,0));
 SELECT array_agg(id) INTO prior FROM public.attendance_notifications WHERE user_id=NEW.user_id AND target_role='employee';
 PERFORM public.check_attendance_thresholds(NEW.user_id,NEW.violation_date);
 total:=public.get_monthly_violation_count(NEW.user_id,NEW.violation_date);
 threshold:=COALESCE((public.get_attendance_discipline_config()->>'sp1_threshold')::integer,5);
 label:=CASE NEW.violation_type WHEN 'late_reason_rejected' THEN 'Alasan keterlambatan ditolak' WHEN 'late_no_reason_submitted' THEN 'Terlambat tanpa alasan' WHEN 'absent_without_permission' THEN 'Tidak hadir tanpa izin' WHEN 'no_attendance_record' THEN 'Tidak ada catatan absensi' WHEN 'permission_rejected' THEN 'Izin ditolak' WHEN 'leave_rejected' THEN 'Cuti ditolak' ELSE NEW.violation_type END;
 detail:=format('%s pada tanggal %s dihitung sebagai pelanggaran ke-%s bulan ini dari ambang SP1 di %s.',label,NEW.violation_date,total,threshold);
 IF NEW.violation_type='late_reason_rejected' THEN detail:=detail||' Catatan HR: '||COALESCE(NEW.description,''); END IF;
 k:=CASE WHEN NEW.violation_type='late_reason_rejected' AND NEW.late_reason_id IS NOT NULL THEN 'reason:'||NEW.late_reason_id::text||':rejected' ELSE 'violation:'||NEW.id::text END;
 SELECT id INTO n FROM public.attendance_notifications WHERE user_id=NEW.user_id AND target_role='employee' AND NOT(id=ANY(COALESCE(prior,ARRAY[]::uuid[]))) AND notif_type IN ('monthly_violation_progress','sp1_issued','sp2_issued','account_locked','lock_warning','rolling_3month_warning') ORDER BY CASE notif_type WHEN 'account_locked' THEN 0 WHEN 'sp2_issued' THEN 1 WHEN 'sp1_issued' THEN 2 WHEN 'monthly_violation_progress' THEN 3 ELSE 4 END LIMIT 1;
 IF n IS NOT NULL THEN
 UPDATE public.attendance_notifications SET message=message||' '||detail,attendance_date=NEW.violation_date,attendance_id=NEW.attendance_id,event_key=k WHERE id=n;
 ELSE
 INSERT INTO public.attendance_notifications(user_id,notif_type,title,message,related_id,target_role,attendance_date,attendance_id,event_key)
 VALUES(NEW.user_id,CASE WHEN NEW.violation_type='late_reason_rejected' THEN 'late_reason_rejected' ELSE 'violation_recorded' END,'Pelanggaran Absensi Dicatat',detail,NEW.id,'employee',NEW.violation_date,NEW.attendance_id,k) ON CONFLICT(user_id,event_key) WHERE event_key IS NOT NULL DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.notify_counted_attendance_violation() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER notify_counted_attendance_violation AFTER INSERT ON public.attendance_violations FOR EACH ROW EXECUTE FUNCTION public.notify_counted_attendance_violation();
DO $patch$
DECLARE def text;
BEGIN
 SELECT pg_get_functiondef('public.create_attendance_violation(uuid,uuid,date,text,text,text,uuid)'::regprocedure) INTO def;
 def:=replace(def,'    PERFORM public.check_attendance_thresholds(p_user_id, p_violation_date);','    -- Thresholds and employee notification are handled atomically by the insert trigger.');
 EXECUTE def;
 SELECT pg_get_functiondef('public.approve_late_reason(uuid,text)'::regprocedure) INTO def;
 def:=replace(def,'WHERE id = reason_id;','WHERE id = reason_id FOR UPDATE;');
 def:=replace(def,E'END;\n$function$',E'  PERFORM public.notify_late_reason_decision(reason_id);\nEND;\n$function$');
 EXECUTE def;
 SELECT pg_get_functiondef('public.reject_late_reason(uuid,text)'::regprocedure) INTO def;
 def:=replace(def,'WHERE lr.id = reason_id;','WHERE lr.id = reason_id FOR UPDATE;');
 def:=replace(def,$old$(v_row.submitted_at AT TIME ZONE 'Asia/Jakarta')::date$old$,$new$(SELECT (a.check_in_time AT TIME ZONE 'Asia/Jakarta')::date FROM public.attendance a WHERE a.id=v_row.attendance_id)$new$);
 def:=replace(def,E'END;\n$function$',E'  PERFORM public.notify_late_reason_decision(reason_id);\nEND;\n$function$');
 EXECUTE def;
END $patch$;
CREATE OR REPLACE FUNCTION public.send_late_reason_reminders() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a record; total integer:=0; inserted integer; deadline timestamptz; now_at timestamptz:=clock_timestamp();
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' AND current_user NOT IN ('postgres','supabase_admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
 FOR a IN SELECT at.* FROM public.attendance at JOIN public.profiles p ON p.id=at.user_id
 WHERE (at.status='terlambat' OR COALESCE(at.late_minutes,0)>0) AND p.status='Active' AND COALESCE(p.departemen,'') NOT IN ('BOD','Komisaris') AND NOT public.has_role(p.id,'admin'::public.app_role)
 AND at.check_in_time+make_interval(hours=>public.late_reason_deadline_hours())<=now_at+interval '4 hours'
 AND at.check_in_time+make_interval(hours=>public.late_reason_deadline_hours())>now_at+interval '3 hours'
 AND NOT EXISTS(SELECT 1 FROM public.late_reasons lr WHERE lr.attendance_id=at.id)
 AND NOT EXISTS(SELECT 1 FROM public.attendance_violations v WHERE v.attendance_id=at.id)
 ORDER BY at.check_in_time FOR UPDATE OF at
 LOOP
 IF EXISTS(SELECT 1 FROM public.late_reasons lr WHERE lr.attendance_id=a.id) THEN CONTINUE; END IF;
 deadline:=a.check_in_time+make_interval(hours=>public.late_reason_deadline_hours());
 INSERT INTO public.attendance_notifications(user_id,notif_type,title,message,related_id,target_role,attendance_date,attendance_id,event_key)
 VALUES(a.user_id,'late_reason_reminder','Pengingat Alasan Keterlambatan',format('Alasan keterlambatan tanggal %s belum dikirim. Sisa waktu sekitar 4 jam; batas pengiriman %s WIB.',(a.check_in_time AT TIME ZONE 'Asia/Jakarta')::date,to_char(deadline AT TIME ZONE 'Asia/Jakarta','DD-MM-YYYY HH24:MI')),a.id,'employee',(a.check_in_time AT TIME ZONE 'Asia/Jakarta')::date,a.id,'reminder:'||a.id::text)
 ON CONFLICT(user_id,event_key) WHERE event_key IS NOT NULL DO NOTHING;
 GET DIAGNOSTICS inserted=ROW_COUNT; total:=total+inserted;
 END LOOP;
 RETURN total;
END $$;
REVOKE ALL ON FUNCTION public.send_late_reason_reminders() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.send_late_reason_reminders() TO service_role;