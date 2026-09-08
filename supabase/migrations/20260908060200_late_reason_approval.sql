-- ============================================================
-- ATTENDANCE DISCIPLINE: LATE REASON APPROVAL (Fase 2)
-- Menggantikan alur lama yang hanya menempel alasan ke attendance.notes
-- tanpa approval workflow.
-- ============================================================

-- late_reasons hanya boleh ditulis lewat RPC security definer (RLS tidak
-- memberi employee policy INSERT langsung), supaya validasi kepemilikan
-- attendance record dan status 'terlambat' selalu ditegakkan di server.
CREATE OR REPLACE FUNCTION public.submit_late_reason(
  p_attendance_id uuid,
  p_reason text,
  p_description text DEFAULT NULL,
  p_attachment_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_attendance public.attendance;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'Reason is required';
  END IF;
  IF length(p_reason) > 500 THEN
    RAISE EXCEPTION 'Reason must be 500 characters or less';
  END IF;
  p_reason := regexp_replace(p_reason, E'[\\x00-\\x1F\\x7F]', '', 'g');

  SELECT * INTO v_attendance FROM public.attendance WHERE id = p_attendance_id;
  IF v_attendance.id IS NULL THEN
    RAISE EXCEPTION 'Attendance record not found';
  END IF;
  IF v_attendance.user_id != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF v_attendance.status != 'terlambat' THEN
    RAISE EXCEPTION 'Late reason can only be submitted for late attendance';
  END IF;
  IF EXISTS (SELECT 1 FROM public.late_reasons WHERE attendance_id = p_attendance_id) THEN
    RAISE EXCEPTION 'A late reason has already been submitted for this attendance record';
  END IF;

  INSERT INTO public.late_reasons (attendance_id, user_id, reason, description, attachment_url)
  VALUES (p_attendance_id, auth.uid(), p_reason, p_description, p_attachment_url)
  RETURNING id INTO v_id;

  INSERT INTO public.attendance_notifications (user_id, notif_type, title, message, related_id, target_role)
  SELECT ur.user_id, 'late_reason_pending', 'Alasan Keterlambatan Baru',
         'Ada alasan keterlambatan baru menunggu persetujuan HR.', v_id, 'hr'
  FROM public.user_roles ur WHERE ur.role IN ('admin', 'hr');

  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.submit_late_reason(uuid, text, text, text) FROM anon;

CREATE OR REPLACE FUNCTION public.approve_late_reason(reason_id uuid, notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  approver_id uuid;
  v_row public.late_reasons;
  v_old_data jsonb;
  v_stale_violation public.attendance_violations;
BEGIN
  approver_id := auth.uid();
  IF approver_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.is_discipline_admin() THEN
    RAISE EXCEPTION 'Only admin/HR can approve late reasons';
  END IF;
  IF reason_id IS NULL THEN
    RAISE EXCEPTION 'reason_id is required';
  END IF;
  IF notes IS NOT NULL THEN
    IF length(notes) > 1000 THEN
      RAISE EXCEPTION 'Notes must be 1000 characters or less';
    END IF;
    notes := regexp_replace(notes, E'[\\x00-\\x1F\\x7F]', '', 'g');
  END IF;

  SELECT * INTO v_row FROM public.late_reasons WHERE id = reason_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Late reason not found';
  END IF;
  IF v_row.status != 'pending' THEN
    RAISE EXCEPTION 'Only pending late reasons can be approved';
  END IF;
  v_old_data := to_jsonb(v_row);

  UPDATE public.late_reasons SET
    status = 'approved', approved_by = approver_id, approved_at = now()
  WHERE id = reason_id AND status = 'pending';

  -- Recalculation (Prinsip #5): kalau sebelumnya alasan ini pernah ditolak dan
  -- sudah menghasilkan violation (mis. dikoreksi ulang oleh HR), nonaktifkan
  -- violation tsb TANPA menghapus row-nya, dan catat di audit trail.
  FOR v_stale_violation IN
    SELECT * FROM public.attendance_violations
    WHERE late_reason_id = reason_id AND is_counted = true
  LOOP
    UPDATE public.attendance_violations SET is_counted = false WHERE id = v_stale_violation.id;

    INSERT INTO public.attendance_audit_logs (attendance_id, action_type, changed_by, old_data, new_data, reason)
    VALUES (
      v_row.attendance_id, 'attendance_violation_recalculated', approver_id,
      to_jsonb(v_stale_violation), jsonb_build_object('is_counted', false),
      'Late reason dikoreksi menjadi approved oleh HR, violation terkait dinonaktifkan (histori tetap disimpan)'
    );
  END LOOP;

  INSERT INTO public.attendance_audit_logs (attendance_id, action_type, changed_by, old_data, new_data, reason)
  VALUES (
    v_row.attendance_id, 'late_reason_approved', approver_id,
    v_old_data, jsonb_build_object('status', 'approved'), notes
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.approve_late_reason(uuid, text) FROM anon;

CREATE OR REPLACE FUNCTION public.reject_late_reason(reason_id uuid, reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  rejector_id uuid;
  v_row public.late_reasons;
  v_old_data jsonb;
  v_violation_date date;
BEGIN
  rejector_id := auth.uid();
  IF rejector_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.is_discipline_admin() THEN
    RAISE EXCEPTION 'Only admin/HR can reject late reasons';
  END IF;
  IF reason_id IS NULL THEN
    RAISE EXCEPTION 'reason_id is required';
  END IF;
  IF reason IS NULL OR length(trim(reason)) = 0 THEN
    RAISE EXCEPTION 'Rejection reason is required';
  END IF;
  IF length(reason) > 1000 THEN
    RAISE EXCEPTION 'Rejection reason must be 1000 characters or less';
  END IF;
  reason := regexp_replace(reason, E'[\\x00-\\x1F\\x7F]', '', 'g');

  SELECT * INTO v_row FROM public.late_reasons WHERE id = reason_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Late reason not found';
  END IF;
  IF v_row.status != 'pending' THEN
    RAISE EXCEPTION 'Only pending late reasons can be rejected';
  END IF;
  v_old_data := to_jsonb(v_row);

  UPDATE public.late_reasons SET
    status = 'rejected', rejection_reason = reason, approved_by = rejector_id, approved_at = now()
  WHERE id = reason_id AND status = 'pending';

  INSERT INTO public.attendance_audit_logs (attendance_id, action_type, changed_by, old_data, new_data, reason)
  VALUES (
    v_row.attendance_id, 'late_reason_rejected', rejector_id,
    v_old_data, jsonb_build_object('status', 'rejected'), reason
  );

  SELECT check_in_time::date INTO v_violation_date FROM public.attendance WHERE id = v_row.attendance_id;
  IF v_violation_date IS NULL THEN
    v_violation_date := CURRENT_DATE;
  END IF;

  PERFORM public.create_attendance_violation(
    v_row.user_id, v_row.attendance_id, v_violation_date,
    'late_reason_rejected', reason, 'hr', reason_id
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reject_late_reason(uuid, text) FROM anon;
