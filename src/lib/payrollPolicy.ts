import { BPJSRatesConfig } from './payrollCalculation';

export type WageBase = 'basic_only' | 'basic_plus_fixed';
export interface WageProfile { basic_salary?: number | null; tunjangan_jabatan?: number | null; tunjangan_operasional?: number | null }

export function getFullMonthlyWage(profile: WageProfile, base: WageBase, config?: BPJSRatesConfig): number {
  const basic = Number(profile.basic_salary) || 0;
  if (base === 'basic_only') return basic;
  const flags = config?.fixed_allowance_components;
  return basic + (flags?.jabatan === false ? 0 : Number(profile.tunjangan_jabatan) || 0)
    + (flags?.operasional === false ? 0 : Number(profile.tunjangan_operasional) || 0);
}

export function getThrWage(profile: WageProfile, year: number, base: WageBase, config?: BPJSRatesConfig): number {
  return getFullMonthlyWage(profile, year >= 2027 ? base : 'basic_only', config);
}

export function getLeaveShortfall(remainingDays: number, availableDays: number, monthlyWage: number) {
  const days = Math.max(0, remainingDays - availableDays);
  return { days, amount: days * monthlyWage / 25 };
}

export function preservePaidComponents(year: number, month: number, existing: { thr: number; overtime_total: number; overtime_hours: number } | undefined, calculated: { thr: number; overtime_total: number; overtime_hours: number }) {
  if (!existing || year !== 2026) return calculated;
  return { thr: existing.thr, overtime_total: month <= 11 ? existing.overtime_total : calculated.overtime_total, overtime_hours: month <= 11 ? existing.overtime_hours : calculated.overtime_hours };
}