import { supabase } from "@/integrations/supabase/client";
import { eachDayOfInterval, format, parseISO } from "date-fns";
import { isWeekend } from "@/hooks/usePolicySettings";

export interface BusinessTravelAllowanceResult {
  ok: boolean;
  amount: number;
  period_month: number;
  period_year: number;
  travel_days_effective: number;
  per_day_attendance: number;
  per_day_travel: number;
  reason?: string;
}

interface CalcInput {
  userId: string;
  startDate: string; // yyyy-MM-dd
  endDate: string;   // yyyy-MM-dd
}

/**
 * Hitung tunjangan perjalanan dinas dan tambahkan ke payroll_overrides bulan
 * dimana start_date berada. Idempoten dalam arti: nilai diakumulasi ke
 * payroll_overrides.tunjangan_perjalanan_dinas (admin bisa edit ulang manual
 * via dialog Tambahan Penghasilan).
 */
export async function applyBusinessTravelAllowance(input: CalcInput): Promise<BusinessTravelAllowanceResult> {
  const { userId, startDate, endDate } = input;
  const start = parseISO(startDate);
  const end = parseISO(endDate);

  const period_month = start.getMonth() + 1;
  const period_year = start.getFullYear();

  // 1. Load configs in parallel
  const [travelCfgRes, attCfgRes, holidayRes] = await Promise.all([
    supabase.rpc("get_business_travel_allowance_config" as any),
    supabase.from("system_settings").select("value").eq("key", "attendance_allowance").maybeSingle(),
    supabase.from("system_settings").select("value").eq("key", "overtime_policy").maybeSingle(),
  ]);

  const travelCfg = (travelCfgRes.data as any) || {};
  if (travelCfg.enabled === false) {
    return { ok: false, amount: 0, period_month, period_year, travel_days_effective: 0, per_day_attendance: 0, per_day_travel: 0, reason: "Fitur tunjangan perjalanan dinas dinonaktifkan." };
  }
  const perDayTravel = Number(travelCfg.per_day_amount) || 0;

  const attCfg = (attCfgRes.data?.value as any) || {};
  const maxAttendance = Number(attCfg.max_amount) || 0;
  const cutoffDay = Number(attCfg.cutoff_day) || 21;
  const excludedIds: string[] = Array.isArray(attCfg.excluded_employee_ids) ? attCfg.excluded_employee_ids : [];

  const holidays: { date: string }[] = (holidayRes.data?.value as any)?.holidays || [];
  const holidaySet = new Set(holidays.map((h) => h.date));

  // 2. Working days for the attendance allowance period containing this month
  // Cut-off: cutoffDay of (period_month - 1) .. (cutoffDay - 1) of period_month
  const periodStart = new Date(period_year, period_month - 2, cutoffDay);
  const periodEndDay = cutoffDay - 1 || 28;
  const periodEnd = new Date(period_year, period_month - 1, periodEndDay);
  const allPeriodDays = eachDayOfInterval({ start: periodStart, end: periodEnd });
  const workingDaysInPeriod = allPeriodDays.filter((d) => {
    const ds = format(d, "yyyy-MM-dd");
    return !isWeekend(ds) && !holidaySet.has(ds);
  }).length;

  // Per-day attendance allowance (clamp). If excluded or attendance disabled, treat as 0.
  let perDayAttendance = 0;
  if (attCfg.enabled !== false && !excludedIds.includes(userId) && workingDaysInPeriod > 0 && maxAttendance > 0) {
    perDayAttendance = maxAttendance / workingDaysInPeriod;
  }

  // 3. Effective travel days (exclude weekends & holidays)
  const travelDays = eachDayOfInterval({ start, end }).filter((d) => {
    const ds = format(d, "yyyy-MM-dd");
    return !isWeekend(ds) && !holidaySet.has(ds);
  }).length;

  // 4. Amount (clamp negative to 0)
  const perDayDiff = Math.max(0, perDayTravel - perDayAttendance);
  const amount = Math.round(perDayDiff * travelDays);

  if (amount <= 0 || travelDays <= 0) {
    return { ok: true, amount: 0, period_month, period_year, travel_days_effective: travelDays, per_day_attendance: perDayAttendance, per_day_travel: perDayTravel };
  }

  // 5. Check payroll period finalized → reject (admin must unlock first)
  const { data: existingPeriod } = await supabase
    .from("payroll_periods")
    .select("status")
    .eq("month", period_month)
    .eq("year", period_year)
    .maybeSingle();
  if (existingPeriod?.status === "finalized") {
    return { ok: false, amount, period_month, period_year, travel_days_effective: travelDays, per_day_attendance: perDayAttendance, per_day_travel: perDayTravel, reason: "Payroll bulan ini sudah final. Buka kunci payroll lebih dulu, lalu generate ulang." };
  }

  // 6. Upsert into payroll_overrides (accumulate)
  const { data: existingOverride } = await supabase
    .from("payroll_overrides")
    .select("id, tunjangan_perjalanan_dinas")
    .eq("user_id", userId)
    .eq("period_month", period_month)
    .eq("period_year", period_year)
    .maybeSingle();

  const prevValue = Number((existingOverride as any)?.tunjangan_perjalanan_dinas) || 0;
  const newValue = prevValue + amount;

  if (existingOverride?.id) {
    await supabase
      .from("payroll_overrides")
      .update({ tunjangan_perjalanan_dinas: newValue, updated_at: new Date().toISOString() } as any)
      .eq("id", existingOverride.id);
  } else {
    await supabase.from("payroll_overrides").insert({
      user_id: userId,
      period_month,
      period_year,
      tunjangan_perjalanan_dinas: newValue,
    } as any);
  }

  // 7. Mirror to payroll row if exists (so detail dialog refreshes without re-generate)
  if (existingPeriod) {
    const { data: periodRow } = await supabase
      .from("payroll_periods")
      .select("id")
      .eq("month", period_month)
      .eq("year", period_year)
      .maybeSingle();
    if (periodRow?.id) {
      await supabase
        .from("payroll")
        .update({ tunjangan_perjalanan_dinas: newValue } as any)
        .eq("user_id", userId)
        .eq("period_id", periodRow.id);
    }
  }

  return {
    ok: true,
    amount,
    period_month,
    period_year,
    travel_days_effective: travelDays,
    per_day_attendance: perDayAttendance,
    per_day_travel: perDayTravel,
  };
}
