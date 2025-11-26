-- Create system settings table
CREATE TABLE IF NOT EXISTS public.system_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for system_settings
CREATE POLICY "Admins can view all settings"
  ON public.system_settings FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert settings"
  ON public.system_settings FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update settings"
  ON public.system_settings FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default settings
INSERT INTO public.system_settings (key, value, description) VALUES
  ('office_location', '{"latitude": -6.2088, "longitude": 106.8456, "radius": 100}'::jsonb, 'Office GPS coordinates and validation radius in meters'),
  ('working_hours', '{"check_in": "08:00", "check_out": "17:00", "late_threshold": "08:30"}'::jsonb, 'Standard working hours and late threshold'),
  ('leave_policy', '{"annual_quota": 12, "max_consecutive_days": 14, "min_notice_days": 3}'::jsonb, 'Leave policy configuration'),
  ('overtime_policy', '{"min_hours": 1, "max_hours": 4, "requires_approval": true}'::jsonb, 'Overtime request policy');
