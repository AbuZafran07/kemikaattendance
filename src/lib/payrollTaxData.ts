import { supabase } from '@/integrations/supabase/client';
import { TaxBracketConfig, calculatePPh21Reconciliation, summarizeTaxYear } from './payrollCalculation';

export async function loadTaxConfig() {
  const [bj, brackets] = await Promise.all([supabase.rpc('get_biaya_jabatan_config'), supabase.rpc('get_pph21_brackets_config')]);
  if (bj.error || brackets.error) throw new Error('Tidak dapat memuat pengaturan pajak');
  const biaya = bj.data as { rate_percent?: number; max_yearly?: number } | null;
  const tax = brackets.data as { brackets?: { limit: number; rate: number }[] } | null;
  return { rate: (biaya?.rate_percent ?? 5) / 100, maxYearly: biaya?.max_yearly ?? 6000000,
    brackets: tax?.brackets?.map(b => ({ limit: b.limit === 0 ? Infinity : b.limit, rate: b.rate / 100 })) as TaxBracketConfig[] | undefined };
}

export async function loadDecemberSimulation(year: number) {
  const [{ data: periods, error: periodError }, config] = await Promise.all([
    supabase.from('payroll_periods').select('id,month').eq('year', year), loadTaxConfig(),
  ]);
  if (periodError) throw periodError;
  if (!periods?.length) return [];
  const { data: payrolls, error } = await supabase.from('payroll').select('*').in('period_id', periods.map(p => p.id));
  if (error) throw error;
  const { data: profiles, error: profileError } = await supabase.from('profiles').select('id,full_name,resign_date').in('id', [...new Set((payrolls || []).map(p => p.user_id))]);
  if (profileError) throw profileError;
  const monthMap = new Map(periods.map(p => [p.id, p.month]));
  const result = [];
  for (const profile of profiles || []) {
    const rows = (payrolls || []).filter(p => p.user_id === profile.id).map(p => ({ ...p, month: monthMap.get(p.period_id) || 0 })).sort((a,b) => a.month-b.month);
    const december = rows.find(r => r.month === 12);
    const november = rows.find(r => r.month === 11);
    if (!december && (!november || profile.resign_date)) continue;
    const last = december || november;
    if (!last) continue;
    const prior = rows.filter(r => r.month < 12);
    const annual = summarizeTaxYear([...prior, { ...last, month: 12 }]);
    const withheld = summarizeTaxYear(prior).withheld;
    const recon = calculatePPh21Reconciliation(annual.bruto, annual.bpjsEmployee, last.ptkp_value, withheld, config.rate, config.maxYearly, config.brackets, annual.monthsWorked);
    result.push({ id: profile.id, name: profile.full_name, estimated: !december, bruto: annual.bruto, bpjs: annual.bpjsEmployee, ptkp: last.ptkp_value, withheld, months: annual.monthsWorked, ...recon });
  }
  return result.sort((a,b) => a.name.localeCompare(b.name));
}