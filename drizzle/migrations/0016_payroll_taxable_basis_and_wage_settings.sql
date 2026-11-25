ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS bruto_basis text NOT NULL DEFAULT 'legacy_incl_jht_jp';
ALTER TABLE public.payroll ADD CONSTRAINT payroll_bruto_basis_valid CHECK (bruto_basis IN ('legacy_incl_jht_jp','pph_taxable'));
COMMENT ON COLUMN public.payroll.bruto_basis IS 'Legacy payroll includes employer JHT/JP; pph_taxable payroll excludes them. Original finalized amounts remain unchanged.';
CREATE OR REPLACE FUNCTION public.get_payroll_wage_bases() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$ SELECT jsonb_build_object('overtime_base', COALESCE((SELECT value FROM public.system_settings WHERE key='overtime_base'), '"basic_plus_fixed"'::jsonb), 'thr_base', COALESCE((SELECT value FROM public.system_settings WHERE key='thr_base'), '"basic_plus_fixed"'::jsonb)); $$;
REVOKE ALL ON FUNCTION public.get_payroll_wage_bases() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_payroll_wage_bases() TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.save_payroll_wage_bases(p_overtime_base text, p_thr_base text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$ BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'Administrator required'; END IF;
 IF p_overtime_base NOT IN ('basic_only','basic_plus_fixed') OR p_thr_base NOT IN ('basic_only','basic_plus_fixed') OR p_overtime_base IS NULL OR p_thr_base IS NULL THEN RAISE EXCEPTION 'Invalid wage base'; END IF;
 INSERT INTO public.system_settings(key,value,description) VALUES ('overtime_base',to_jsonb(p_overtime_base),'Dasar upah lembur PP 35/2021'),('thr_base',to_jsonb(p_thr_base),'Dasar upah THR Permenaker 6/2016, mulai 2027') ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=now();
 END; $$;
REVOKE ALL ON FUNCTION public.save_payroll_wage_bases(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_payroll_wage_bases(text,text) TO authenticated;