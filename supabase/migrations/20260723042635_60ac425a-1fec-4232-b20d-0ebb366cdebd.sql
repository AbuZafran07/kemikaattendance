
-- contract_history
CREATE TABLE public.contract_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contract_number TEXT,
  contract_type TEXT,
  start_date DATE,
  end_date DATE,
  changes JSONB,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_history TO authenticated;
GRANT ALL ON public.contract_history TO service_role;
ALTER TABLE public.contract_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/HR full access contract_history" ON public.contract_history
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'hr'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'hr'::public.app_role));

CREATE POLICY "Employee view own contract_history" ON public.contract_history
  FOR SELECT TO authenticated
  USING (employee_id = auth.uid());

CREATE INDEX idx_contract_history_employee ON public.contract_history(employee_id, created_at DESC);

-- contract_reminders_log
CREATE TABLE public.contract_reminders_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contract_end_date DATE NOT NULL,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('H30','H7','EXPIRED')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  channels JSONB,
  recipients JSONB,
  status TEXT DEFAULT 'sent',
  error_message TEXT
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_reminders_log TO authenticated;
GRANT ALL ON public.contract_reminders_log TO service_role;
ALTER TABLE public.contract_reminders_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/HR view reminders_log" ON public.contract_reminders_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'hr'::public.app_role));

CREATE POLICY "Service role manage reminders_log" ON public.contract_reminders_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE UNIQUE INDEX idx_reminder_unique ON public.contract_reminders_log(employee_id, contract_end_date, reminder_type);

-- Trigger: auto-log changes to contract fields
CREATE OR REPLACE FUNCTION public.log_contract_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  diff JSONB := '{}'::jsonb;
BEGIN
  IF COALESCE(NEW.contract_number,'') IS DISTINCT FROM COALESCE(OLD.contract_number,'') THEN
    diff := diff || jsonb_build_object('contract_number', jsonb_build_object('old', OLD.contract_number, 'new', NEW.contract_number));
  END IF;
  IF COALESCE(NEW.contract_type,'') IS DISTINCT FROM COALESCE(OLD.contract_type,'') THEN
    diff := diff || jsonb_build_object('contract_type', jsonb_build_object('old', OLD.contract_type, 'new', NEW.contract_type));
  END IF;
  IF NEW.contract_start_date IS DISTINCT FROM OLD.contract_start_date THEN
    diff := diff || jsonb_build_object('start_date', jsonb_build_object('old', OLD.contract_start_date, 'new', NEW.contract_start_date));
  END IF;
  IF NEW.contract_end_date IS DISTINCT FROM OLD.contract_end_date THEN
    diff := diff || jsonb_build_object('end_date', jsonb_build_object('old', OLD.contract_end_date, 'new', NEW.contract_end_date));
  END IF;

  IF diff <> '{}'::jsonb THEN
    INSERT INTO public.contract_history(
      employee_id, contract_number, contract_type, start_date, end_date, changes, created_by
    ) VALUES (
      NEW.id, NEW.contract_number, NEW.contract_type, NEW.contract_start_date, NEW.contract_end_date, diff, auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_contract_change ON public.profiles;
CREATE TRIGGER trg_log_contract_change
AFTER UPDATE OF contract_number, contract_type, contract_start_date, contract_end_date
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.log_contract_change();
