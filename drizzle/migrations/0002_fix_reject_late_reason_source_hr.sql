CREATE OR REPLACE FUNCTION public.reject_late_reason(reason_id uuid, reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  rejector_id uuid;
  v_row public.late_reasons;
  v_old_data jsonb;
  v_reason text;
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
  v_reason := regexp_replace(reason, E'[\\x00-\\x1F\\x7F]', '', 'g');

  SELECT * INTO v_row FROM public.late_reasons lr WHERE lr.id = reason_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Late reason not found';
  END IF;
  IF v_row.status != 'pending' THEN
    RAISE EXCEPTION 'Only pending late reasons can be rejected';
  END IF;
  v_old_data := to_jsonb(v_row);

  UPDATE public.late_reasons SET
    status = 'rejected', rejection_reason = v_reason, approved_by = rejector_id, approved_at = now()
  WHERE id = reason_id AND status = 'pending';

  INSERT INTO public.attendance_audit_logs (attendance_id, action_type, changed_by, old_data, new_data, reason)
  VALUES (
    v_row.attendance_id, 'late_reason_rejected', rejector_id,
    v_old_data, jsonb_build_object('status', 'rejected'), v_reason
  );

  PERFORM public.create_attendance_violation(
    v_row.user_id,
    v_row.attendance_id,
    (v_row.submitted_at AT TIME ZONE 'Asia/Jakarta')::date,
    'late_reason_rejected',
    'Alasan keterlambatan ditolak: ' || v_reason,
    'hr',
    v_row.id
  );
END;
$function$;
