-- ============================================================
-- ATTENDANCE DISCIPLINE: UNLOCK LETTER + UNLOCK FLOW (Fase 4.1)
-- ============================================================

-- Notifikasi tambahan untuk hasil review surat unlock oleh HR
ALTER TABLE public.attendance_notifications DROP CONSTRAINT IF EXISTS attendance_notifications_notif_type_check;
ALTER TABLE public.attendance_notifications ADD CONSTRAINT attendance_notifications_notif_type_check
  CHECK (notif_type IN (
    'late_reason_pending', 'monthly_violation_progress', 'sp1_issued', 'sp2_issued',
    'lock_warning', 'account_locked', 'account_unlocked', 'rolling_3month_warning',
    'unlock_letter_submitted', 'unlock_letter_approved', 'unlock_letter_rejected'
  ));

CREATE SEQUENCE IF NOT EXISTS public.unlock_letter_number_seq START 1;

-- Karyawan mengajukan surat permohonan pembukaan lock (ditandatangani digital).
CREATE OR REPLACE FUNCTION public.submit_unlock_letter(
  p_lock_id uuid,
  p_statement_text text,
  p_signature_data text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_lock public.account_locks;
  v_letter_number text;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_statement_text IS NULL OR length(trim(p_statement_text)) = 0 THEN
    RAISE EXCEPTION 'Statement text is required';
  END IF;
  IF p_signature_data IS NULL OR length(trim(p_signature_data)) = 0 THEN
    RAISE EXCEPTION 'Signature is required';
  END IF;

  SELECT * INTO v_lock FROM public.account_locks WHERE id = p_lock_id;
  IF v_lock.id IS NULL THEN
    RAISE EXCEPTION 'Lock not found';
  END IF;
  IF v_lock.user_id != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF v_lock.status != 'locked' THEN
    RAISE EXCEPTION 'Account is not currently locked';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.account_unlock_letters
    WHERE lock_id = p_lock_id AND status IN ('submitted', 'approved')
  ) THEN
    RAISE EXCEPTION 'An unlock letter is already submitted or approved for this lock';
  END IF;

  v_letter_number := 'SP-UNLOCK/' || to_char(now(), 'YYYY') || '/' || to_char(now(), 'MM')
    || '/' || lpad(nextval('public.unlock_letter_number_seq')::text, 4, '0');

  INSERT INTO public.account_unlock_letters (
    lock_id, user_id, letter_number, statement_text, employee_signature_data
  ) VALUES (
    p_lock_id, auth.uid(), v_letter_number, trim(p_statement_text), p_signature_data
  )
  RETURNING id INTO v_id;

  UPDATE public.account_locks SET unlock_letter_id = v_id WHERE id = p_lock_id;

  INSERT INTO public.attendance_notifications (user_id, notif_type, title, message, related_id, target_role)
  SELECT ur.user_id, 'unlock_letter_submitted', 'Surat Pengajuan Unlock Baru',
         format('Karyawan mengajukan surat permohonan pembukaan lock (%s).', v_letter_number),
         v_id, 'hr'
  FROM public.user_roles ur WHERE ur.role IN ('admin', 'hr');

  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.submit_unlock_letter(uuid, text, text) FROM anon;

-- Dipanggil klien setelah PDF surat berhasil di-generate & diupload ke storage.
CREATE OR REPLACE FUNCTION public.set_unlock_letter_document(p_letter_id uuid, p_document_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_owner uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT user_id INTO v_owner FROM public.account_unlock_letters WHERE id = p_letter_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Unlock letter not found';
  END IF;
  IF v_owner != auth.uid() AND NOT public.is_discipline_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.account_unlock_letters SET document_url = p_document_url WHERE id = p_letter_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_unlock_letter_document(uuid, text) FROM anon;

CREATE OR REPLACE FUNCTION public.approve_unlock_letter(p_letter_id uuid, p_hr_signature_data text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  approver_id uuid;
  v_row public.account_unlock_letters;
BEGIN
  approver_id := auth.uid();
  IF approver_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.is_discipline_admin() THEN
    RAISE EXCEPTION 'Only admin/HR can approve unlock letters';
  END IF;

  SELECT * INTO v_row FROM public.account_unlock_letters WHERE id = p_letter_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Unlock letter not found';
  END IF;
  IF v_row.status != 'submitted' THEN
    RAISE EXCEPTION 'Only submitted unlock letters can be approved';
  END IF;

  UPDATE public.account_unlock_letters SET
    status = 'approved', hr_signature_data = p_hr_signature_data,
    hr_signed_by = approver_id, hr_signed_at = now()
  WHERE id = p_letter_id AND status = 'submitted';

  INSERT INTO public.attendance_notifications (user_id, notif_type, title, message, related_id, target_role)
  VALUES (
    v_row.user_id, 'unlock_letter_approved', 'Surat Pengajuan Unlock Disetujui',
    'Surat permohonan pembukaan lock Anda telah disetujui HR. Menunggu proses unlock akun.',
    p_letter_id, 'employee'
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.approve_unlock_letter(uuid, text) FROM anon;

CREATE OR REPLACE FUNCTION public.reject_unlock_letter(p_letter_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  rejector_id uuid;
  v_row public.account_unlock_letters;
BEGIN
  rejector_id := auth.uid();
  IF rejector_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.is_discipline_admin() THEN
    RAISE EXCEPTION 'Only admin/HR can reject unlock letters';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'Rejection reason is required';
  END IF;

  SELECT * INTO v_row FROM public.account_unlock_letters WHERE id = p_letter_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Unlock letter not found';
  END IF;
  IF v_row.status != 'submitted' THEN
    RAISE EXCEPTION 'Only submitted unlock letters can be rejected';
  END IF;

  UPDATE public.account_unlock_letters SET
    status = 'rejected', rejection_reason = trim(p_reason)
  WHERE id = p_letter_id AND status = 'submitted';

  INSERT INTO public.attendance_notifications (user_id, notif_type, title, message, related_id, target_role)
  VALUES (
    v_row.user_id, 'unlock_letter_rejected', 'Surat Pengajuan Unlock Ditolak',
    format('Surat permohonan pembukaan lock Anda ditolak: %s. Silakan ajukan surat baru.', trim(p_reason)),
    p_letter_id, 'employee'
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reject_unlock_letter(uuid, text) FROM anon;

-- Unlock hanya boleh dilakukan admin/hr, dan hanya kalau coaching completed
-- DAN surat unlock approved (3 lapis syarat, lihat Fase 4.1 di spec).
CREATE OR REPLACE FUNCTION public.unlock_account(p_lock_id uuid, p_coaching_id uuid, p_unlock_letter_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  actor_id uuid;
  v_lock public.account_locks;
  v_coaching public.employee_coaching;
  v_letter public.account_unlock_letters;
BEGIN
  actor_id := auth.uid();
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.is_discipline_admin() THEN
    RAISE EXCEPTION 'Only admin/HR can unlock accounts';
  END IF;

  SELECT * INTO v_lock FROM public.account_locks WHERE id = p_lock_id;
  IF v_lock.id IS NULL THEN
    RAISE EXCEPTION 'Lock not found';
  END IF;
  IF v_lock.status != 'locked' THEN
    RAISE EXCEPTION 'Account is not currently locked';
  END IF;

  SELECT * INTO v_coaching FROM public.employee_coaching WHERE id = p_coaching_id;
  IF v_coaching.id IS NULL OR v_coaching.user_id != v_lock.user_id THEN
    RAISE EXCEPTION 'Coaching record not found for this employee';
  END IF;
  IF v_coaching.status != 'completed' THEN
    RAISE EXCEPTION 'Coaching must be completed before unlocking';
  END IF;

  SELECT * INTO v_letter FROM public.account_unlock_letters WHERE id = p_unlock_letter_id;
  IF v_letter.id IS NULL OR v_letter.lock_id != p_lock_id THEN
    RAISE EXCEPTION 'Unlock letter not found for this lock';
  END IF;
  IF v_letter.status != 'approved' THEN
    RAISE EXCEPTION 'Unlock letter must be approved before unlocking';
  END IF;

  UPDATE public.account_locks SET
    status = 'unlocked', unlocked_at = now(), unlocked_by = actor_id,
    coaching_id = p_coaching_id, unlock_letter_id = p_unlock_letter_id
  WHERE id = p_lock_id AND status = 'locked';

  UPDATE public.profiles SET account_status = 'active' WHERE id = v_lock.user_id;

  INSERT INTO public.attendance_notifications (user_id, notif_type, title, message, related_id, target_role)
  VALUES (
    v_lock.user_id, 'account_unlocked', 'Akun Absensi Dibuka Kembali',
    'Akun absensi Anda telah dibuka kembali oleh HR. Anda dapat melakukan absensi seperti biasa.',
    p_lock_id, 'employee'
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.unlock_account(uuid, uuid, uuid) FROM anon;
