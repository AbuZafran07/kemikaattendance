CREATE OR REPLACE FUNCTION public.protect_submitted_late_reason_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.status = 'no_reason_submitted' AND length(trim(NEW.reason)) > 0 THEN
    NEW.status := 'pending';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_submitted_late_reason_status() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER protect_submitted_late_reason_status
BEFORE INSERT OR UPDATE ON public.late_reasons
FOR EACH ROW EXECUTE FUNCTION public.protect_submitted_late_reason_status();

CREATE OR REPLACE FUNCTION public.protect_late_reason_violation_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.is_counted AND NEW.violation_type IN ('late', 'late_reason_rejected', 'late_no_reason_submitted') THEN
    IF EXISTS (
      SELECT 1 FROM public.late_reasons lr
      WHERE (lr.id = NEW.late_reason_id OR lr.attendance_id = NEW.attendance_id)
        AND (lr.status IN ('pending', 'approved')
          OR (lr.status = 'no_reason_submitted' AND length(trim(lr.reason)) > 0))
    ) THEN
      NEW.is_counted := false;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_late_reason_violation_count() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER protect_late_reason_violation_count
BEFORE INSERT OR UPDATE ON public.attendance_violations
FOR EACH ROW EXECUTE FUNCTION public.protect_late_reason_violation_count();