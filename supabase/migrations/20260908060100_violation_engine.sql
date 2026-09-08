-- ============================================================
-- ATTENDANCE DISCIPLINE: VIOLATION ENGINE (Fase 3 core)
-- ============================================================

-- Helper: apakah caller boleh mengelola data disiplin absensi?
-- (admin/hr lewat JWT biasa, atau service_role key yang dipakai edge function terjadwal)
CREATE OR REPLACE FUNCTION public.is_discipline_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT auth.role() = 'service_role'
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'hr'::public.app_role);
$$;
REVOKE EXECUTE ON FUNCTION public.is_discipline_admin() FROM anon;

-- Counter bulan berjalan (dihitung dinamis dari data, bukan kolom statis)
CREATE OR REPLACE FUNCTION public.get_monthly_violation_count(p_user_id uuid, p_month date)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id AND NOT public.is_discipline_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN (
    SELECT COUNT(*)::integer
    FROM public.attendance_violations
    WHERE user_id = p_user_id
      AND is_counted = true
      AND date_trunc('month', violation_date) = date_trunc('month', p_month)
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_monthly_violation_count(uuid, date) FROM anon;

-- Counter rolling 3 bulan kalender (bulan berjalan + 2 bulan sebelumnya, dinamis sesuai tanggal)
CREATE OR REPLACE FUNCTION public.get_rolling_3month_violation_count(p_user_id uuid, p_reference_date date)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id AND NOT public.is_discipline_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN (
    SELECT COUNT(*)::integer
    FROM public.attendance_violations
    WHERE user_id = p_user_id
      AND is_counted = true
      AND violation_date >= (date_trunc('month', p_reference_date) - interval '2 months')::date
      AND violation_date < (date_trunc('month', p_reference_date) + interval '1 month')::date
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_rolling_3month_violation_count(uuid, date) FROM anon;

-- Threshold-event checker: dipanggil tiap kali ada violation baru.
-- Menerbitkan SP1/SP2/Lock sekali per periode (bukan berulang tiap violation tambahan),
-- plus early warning rolling 3-bulan dan notifikasi progres opsional.
CREATE OR REPLACE FUNCTION public.check_attendance_thresholds(p_user_id uuid, p_reference_date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_config jsonb;
  v_sp1 integer;
  v_sp2 integer;
  v_lock integer;
  v_warn3 integer;
  v_progress_enabled boolean;
  v_monthly integer;
  v_rolling integer;
  v_month_start date;
  v_lock_id uuid;
  v_sp_id uuid;
  v_title text;
  v_message text;
BEGIN
  IF NOT public.is_discipline_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_config := public.get_attendance_discipline_config();
  v_sp1 := COALESCE((v_config->>'sp1_threshold')::integer, 5);
  v_sp2 := COALESCE((v_config->>'sp2_threshold')::integer, 8);
  v_lock := COALESCE((v_config->>'lock_threshold')::integer, 11);
  v_warn3 := COALESCE((v_config->>'three_month_warning_threshold')::integer, 10);
  v_progress_enabled := COALESCE((v_config->>'enable_progress_notifications')::boolean, true);

  v_month_start := date_trunc('month', p_reference_date)::date;
  v_monthly := public.get_monthly_violation_count(p_user_id, p_reference_date);

  -- Lock > SP2 > SP1 (mutually exclusive, tidak menerbitkan berulang dalam periode yang sama)
  IF v_monthly >= v_lock THEN
    IF NOT EXISTS (SELECT 1 FROM public.account_locks WHERE user_id = p_user_id AND status = 'locked') THEN
      INSERT INTO public.account_locks (user_id, reason, violation_count_at_lock)
      VALUES (
        p_user_id,
        format('Akun dikunci otomatis karena mencapai %s pelanggaran absensi pada bulan berjalan (ambang: %s)', v_monthly, v_lock),
        v_monthly
      )
      RETURNING id INTO v_lock_id;

      UPDATE public.profiles SET account_status = 'locked' WHERE id = p_user_id;

      INSERT INTO public.attendance_notifications (user_id, notif_type, title, message, related_id, target_role)
      VALUES (
        p_user_id, 'account_locked', 'Akun Absensi Dikunci',
        format('Akun absensi Anda dikunci karena mencapai %s pelanggaran absensi pada bulan ini. Silakan hubungi HR untuk proses pembinaan.', v_monthly),
        v_lock_id, 'employee'
      );

      INSERT INTO public.attendance_notifications (user_id, notif_type, title, message, related_id, target_role)
      SELECT ur.user_id, 'account_locked', 'Akun Karyawan Dikunci',
             format('Akun absensi seorang karyawan dikunci otomatis setelah %s pelanggaran bulan ini.', v_monthly),
             v_lock_id, 'hr'
      FROM public.user_roles ur WHERE ur.role IN ('admin', 'hr');
    END IF;
  ELSIF v_monthly >= v_sp2 THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.disciplinary_actions
      WHERE user_id = p_user_id AND warning_type = 'sp2' AND period_month = v_month_start
    ) THEN
      INSERT INTO public.disciplinary_actions (user_id, warning_type, period_month, violation_count_at_issuance)
      VALUES (p_user_id, 'sp2', v_month_start, v_monthly)
      RETURNING id INTO v_sp_id;

      INSERT INTO public.attendance_notifications (user_id, notif_type, title, message, related_id, target_role)
      VALUES (
        p_user_id, 'sp2_issued', 'Surat Peringatan 2 (SP2) Diterbitkan',
        format('Anda menerima SP2 karena mencapai %s pelanggaran absensi pada bulan ini.', v_monthly),
        v_sp_id, 'employee'
      );

      INSERT INTO public.attendance_notifications (user_id, notif_type, title, message, related_id, target_role)
      SELECT ur.user_id, 'sp2_issued', 'SP2 Diterbitkan ke Karyawan',
             format('SP2 diterbitkan otomatis setelah %s pelanggaran bulan ini.', v_monthly),
             v_sp_id, 'hr'
      FROM public.user_roles ur WHERE ur.role IN ('admin', 'hr');
    END IF;
  ELSIF v_monthly >= v_sp1 THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.disciplinary_actions
      WHERE user_id = p_user_id AND warning_type = 'sp1' AND period_month = v_month_start
    ) THEN
      INSERT INTO public.disciplinary_actions (user_id, warning_type, period_month, violation_count_at_issuance)
      VALUES (p_user_id, 'sp1', v_month_start, v_monthly)
      RETURNING id INTO v_sp_id;

      INSERT INTO public.attendance_notifications (user_id, notif_type, title, message, related_id, target_role)
      VALUES (
        p_user_id, 'sp1_issued', 'Surat Peringatan 1 (SP1) Diterbitkan',
        format('Anda menerima SP1 karena mencapai %s pelanggaran absensi pada bulan ini.', v_monthly),
        v_sp_id, 'employee'
      );

      INSERT INTO public.attendance_notifications (user_id, notif_type, title, message, related_id, target_role)
      SELECT ur.user_id, 'sp1_issued', 'SP1 Diterbitkan ke Karyawan',
             format('SP1 diterbitkan otomatis setelah %s pelanggaran bulan ini.', v_monthly),
             v_sp_id, 'hr'
      FROM public.user_roles ur WHERE ur.role IN ('admin', 'hr');
    END IF;
  END IF;

  -- Notifikasi progres opsional (mendekati threshold berikutnya)
  IF v_progress_enabled AND v_monthly IN (3, 4, 7, 10) THEN
    INSERT INTO public.attendance_notifications (user_id, notif_type, title, message, related_id, target_role)
    VALUES (
      p_user_id, 'monthly_violation_progress', 'Progres Pelanggaran Absensi Bulan Ini',
      format('Anda sudah mencapai %s pelanggaran absensi pada bulan ini. Perhatikan kedisiplinan kehadiran Anda.', v_monthly),
      NULL, 'employee'
    );
  END IF;

  -- Early warning rolling 3-bulan (TIDAK menerbitkan SP, hanya peringatan dini)
  v_rolling := public.get_rolling_3month_violation_count(p_user_id, p_reference_date);
  IF v_rolling >= v_warn3 THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.attendance_notifications
      WHERE user_id = p_user_id
        AND notif_type = 'rolling_3month_warning'
        AND date_trunc('month', created_at)::date = v_month_start
    ) THEN
      INSERT INTO public.attendance_notifications (user_id, notif_type, title, message, related_id, target_role)
      VALUES (
        p_user_id, 'rolling_3month_warning', 'Peringatan Dini: Pelanggaran 3 Bulan Terakhir',
        format('Total pelanggaran absensi Anda dalam 3 bulan kalender terakhir (termasuk bulan ini) mencapai %s, melewati ambang peringatan dini (%s). Ini bukan SP, namun mohon diperhatikan.', v_rolling, v_warn3),
        NULL, 'employee'
      );

      INSERT INTO public.attendance_notifications (user_id, notif_type, title, message, related_id, target_role)
      SELECT ur.user_id, 'rolling_3month_warning', 'Peringatan Dini Karyawan (3 Bulan)',
             format('Seorang karyawan mencapai %s pelanggaran dalam 3 bulan kalender terakhir.', v_rolling),
             NULL, 'hr'
      FROM public.user_roles ur WHERE ur.role IN ('admin', 'hr');
    END IF;
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.check_attendance_thresholds(uuid, date) FROM anon;

-- Entry point utama: buat 1 violation untuk 1 kejadian (Prinsip #4: max 1 violation aktif
-- per user per tanggal), lalu trigger recalculation + threshold checker.
CREATE OR REPLACE FUNCTION public.create_attendance_violation(
  p_user_id uuid,
  p_attendance_id uuid,
  p_violation_date date,
  p_violation_type text,
  p_description text DEFAULT NULL,
  p_source text DEFAULT 'system',
  p_late_reason_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_violation_id uuid;
BEGIN
  IF NOT public.is_discipline_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_violation_type NOT IN (
    'late_reason_rejected', 'late_no_reason_submitted', 'absent_without_permission',
    'no_attendance_record', 'permission_rejected', 'leave_rejected'
  ) THEN
    RAISE EXCEPTION 'Invalid violation_type: %', p_violation_type;
  END IF;

  SELECT id INTO v_violation_id
  FROM public.attendance_violations
  WHERE user_id = p_user_id AND violation_date = p_violation_date AND is_counted = true;

  IF v_violation_id IS NULL THEN
    INSERT INTO public.attendance_violations (
      user_id, attendance_id, late_reason_id, violation_date, violation_type,
      description, is_counted, source, created_by
    ) VALUES (
      p_user_id, p_attendance_id, p_late_reason_id, p_violation_date, p_violation_type,
      p_description, true, p_source, auth.uid()
    )
    RETURNING id INTO v_violation_id;

    PERFORM public.check_attendance_thresholds(p_user_id, p_violation_date);
  END IF;

  RETURN v_violation_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_attendance_violation(uuid, uuid, date, text, text, text, uuid) FROM anon;
