
-- ========== TABLES ==========
CREATE TABLE public.assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  brand TEXT,
  serial_number TEXT,
  purchase_date DATE,
  purchase_price NUMERIC DEFAULT 0,
  condition TEXT NOT NULL DEFAULT 'good',
  status TEXT NOT NULL DEFAULT 'available',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.asset_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  returned_at TIMESTAMPTZ,
  condition_out TEXT,
  condition_in TEXT,
  notes TEXT,
  assigned_by UUID,
  returned_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_asset_assignments_employee ON public.asset_assignments(employee_id);
CREATE INDEX idx_asset_assignments_asset ON public.asset_assignments(asset_id);

CREATE TABLE public.exit_interviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL UNIQUE,
  interview_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT,
  reason_detail TEXT,
  satisfaction JSONB DEFAULT '{}'::jsonb,
  suggestions TEXT,
  would_recommend BOOLEAN,
  interviewer UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.handover_checklists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL UNIQUE,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'in_progress',
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== GRANTS ==========
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets TO authenticated;
GRANT ALL ON public.assets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_assignments TO authenticated;
GRANT ALL ON public.asset_assignments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exit_interviews TO authenticated;
GRANT ALL ON public.exit_interviews TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.handover_checklists TO authenticated;
GRANT ALL ON public.handover_checklists TO service_role;

-- ========== RLS ==========
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exit_interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.handover_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/HR manage assets" ON public.assets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'hr'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'hr'::public.app_role));
CREATE POLICY "Employees view assets assigned to them" ON public.assets FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.asset_assignments aa WHERE aa.asset_id = assets.id AND aa.employee_id = auth.uid() AND aa.returned_at IS NULL));

CREATE POLICY "Admin/HR manage asset_assignments" ON public.asset_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'hr'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'hr'::public.app_role));
CREATE POLICY "Employees view own asset_assignments" ON public.asset_assignments FOR SELECT TO authenticated
  USING (employee_id = auth.uid());

CREATE POLICY "Admin/HR manage exit_interviews" ON public.exit_interviews FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'hr'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'hr'::public.app_role));
CREATE POLICY "Employees view own exit_interview" ON public.exit_interviews FOR SELECT TO authenticated
  USING (employee_id = auth.uid());

CREATE POLICY "Admin/HR manage handover_checklists" ON public.handover_checklists FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'hr'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'hr'::public.app_role));
CREATE POLICY "Employees view own handover" ON public.handover_checklists FOR SELECT TO authenticated
  USING (employee_id = auth.uid());

-- ========== TRIGGERS ==========
CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_asset_assignments_updated_at BEFORE UPDATE ON public.asset_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_exit_interviews_updated_at BEFORE UPDATE ON public.exit_interviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_handover_checklists_updated_at BEFORE UPDATE ON public.handover_checklists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.sync_asset_status_on_assignment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.assets SET status = 'assigned', updated_at = now() WHERE id = NEW.asset_id;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.returned_at IS NOT NULL AND OLD.returned_at IS NULL THEN
      UPDATE public.assets SET status = 'available',
        condition = COALESCE(NEW.condition_in, condition),
        updated_at = now()
      WHERE id = NEW.asset_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_sync_asset_status
AFTER INSERT OR UPDATE ON public.asset_assignments
FOR EACH ROW EXECUTE FUNCTION public.sync_asset_status_on_assignment();
