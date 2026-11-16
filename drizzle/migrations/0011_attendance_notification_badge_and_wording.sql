ALTER TABLE public.attendance_notifications ADD COLUMN pushed_at timestamptz;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_notifications;
CREATE OR REPLACE FUNCTION public.attendance_notification_date(p_date date) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT extract(day FROM p_date)::integer::text||' '||(ARRAY['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'])[extract(month FROM p_date)::integer]||' '||extract(year FROM p_date)::integer::text $$;
REVOKE ALL ON FUNCTION public.attendance_notification_date(date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.attendance_notification_date(date) TO authenticated,service_role;
DO $patch$
DECLARE def text; old text; new text;
BEGIN
 SELECT pg_get_functiondef('public.notify_counted_attendance_violation()'::regprocedure) INTO def;
 def:=replace(def,'threshold integer;','threshold integer; config jsonb; next_threshold text;');
 old:=$old$threshold:=COALESCE((public.get_attendance_discipline_config()->>'sp1_threshold')::integer,5);$old$;
 new:=$new$config:=public.get_attendance_discipline_config();
 threshold:=COALESCE((config->>'sp1_threshold')::integer,5);
 next_threshold:=CASE WHEN total<threshold THEN format('menuju SP1 di %s',threshold)
 WHEN total<COALESCE((config->>'sp2_threshold')::integer,8) THEN format('menuju SP2 di %s',COALESCE((config->>'sp2_threshold')::integer,8))
 WHEN total<COALESCE((config->>'lock_threshold')::integer,11) THEN format('menuju kunci akun di %s',COALESCE((config->>'lock_threshold')::integer,11))
 ELSE 'akun dikunci' END;$new$;
 IF strpos(def,old)=0 THEN RAISE EXCEPTION 'Threshold patch target missing'; END IF;
 def:=replace(def,old,new);
 def:=replace(def,$old$detail:=format('%s pada tanggal %s dihitung sebagai pelanggaran ke-%s bulan ini dari ambang SP1 di %s.',label,NEW.violation_date,total,threshold);$old$,$new$detail:=format('%s pada tanggal %s dihitung sebagai pelanggaran ke-%s bulan ini, %s.',label,public.attendance_notification_date(NEW.violation_date),total,next_threshold);$new$);
 EXECUTE def;
 SELECT pg_get_functiondef('public.notify_late_reason_decision(uuid)'::regprocedure) INTO def;
 def:=replace(def,',d)',',public.attendance_notification_date(d))');
 def:=replace(def,',d,r.rejection_reason)',',public.attendance_notification_date(d),r.rejection_reason)');
 EXECUTE def;
 SELECT pg_get_functiondef('public.send_late_reason_reminders()'::regprocedure) INTO def;
 def:=replace(def,$old$(a.check_in_time AT TIME ZONE 'Asia/Jakarta')::date,to_char(deadline AT TIME ZONE 'Asia/Jakarta','DD-MM-YYYY HH24:MI')$old$,$new$public.attendance_notification_date((a.check_in_time AT TIME ZONE 'Asia/Jakarta')::date),public.attendance_notification_date((deadline AT TIME ZONE 'Asia/Jakarta')::date)||' '||to_char(deadline AT TIME ZONE 'Asia/Jakarta','HH24:MI')$new$);
 EXECUTE def;
END $patch$;