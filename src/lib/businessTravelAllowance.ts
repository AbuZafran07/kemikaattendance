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
  // Detail per periode payroll bila trip melintasi cut-off
  splits?: Array<{
    period_month: number;
    period_year: number;
    days: number;
    amount: number;
    skipped_reason?: string;
  }>;
}

interface CalcInput {
  userId: string;
  startDate: string; // yyyy-MM-dd
  endDate: string;   // yyyy-MM-dd
  dryRun?: boolean;  // jika true: hanya hitung, tidak menulis ke DB
}

/**
 * Tentukan periode payroll (bulan/tahun) berdasarkan cut-off attendance.
 * Aturan: tanggal >= cutoffDay → periode bulan berikutnya.
 *         tanggal <  cutoffDay → periode bulan berjalan.
 */
function payrollPeriodOf(d: Date, cutoffDay: number): { month: number; year: number } {
  const day = d.getDate();
  const m = d.getMonth(); // 0..11
  const y = d.getFullYear();
  if (day >= cutoffDay) {
    const nm = (m + 1) % 12;
    const ny = m === 11 ? y + 1 : y;
    return { month: nm + 1, year: ny };
  }
  return { month: m + 1, year: y };
}

/**
 * Hitung jumlah hari kerja efektif untuk satu periode payroll (cut-off based):
 * mulai cutoffDay bulan sebelumnya s/d (cutoffDay - 1) bulan periode.
 */
function workingDaysOfPeriod(periodMonth: number, periodYear: number, cutoffDay: number, holidaySet: Set<string>): number {
  const periodStart = new Date(periodYear, periodMonth - 2, cutoffDay);
  const periodEndDay = cutoffDay - 1 || 28;
  const periodEnd = new Date(periodYear, periodMonth - 1, periodEndDay);
  return eachDayOfInterval({ start: periodStart, end: periodEnd }).filter((d) => {
    const ds = format(d, "yyyy-MM-dd");
    return !isWeekend(ds) && !holidaySet.has(ds);
  }).length;
}

/**
 * Hitung tunjangan perjalanan dinas dan tambahkan ke payroll_overrides
 * berdasarkan **cut-off attendance** (default 21–20). Trip yang menyeberang
 * cut-off otomatis dipecah ke 2 periode payroll sesuai jumlah hari kerja
 * efektifnya di masing-masing periode.
 */
export async function applyBusinessTravelAllowance(input: CalcInput): Promise<BusinessTravelAllowanceResult> {
  const { userId, startDate, endDate } = input;
  const start = parseISO(startDate);
  const end = parseISO(endDate);

  // 1. Load configs in parallel
  const [travelCfgRes, attCfgRes, holidayRes] = await Promise.all([
    supabase.rpc("get_business_travel_allowance_config" as any),
    supabase.from("system_settings").select("value").eq("key", "attendance_allowance").maybeSingle(),
    supabase.from("system_settings").select("value").eq("key", "overtime_policy").maybeSingle(),
  ]);

  const travelCfg = (travelCfgRes.data as any) || {};
  const fallbackPeriodMonth = start.getMonth() + 1;
  const fallbackPeriodYear = start.getFullYear();
  if (travelCfg.enabled === false) {
    return { ok: false, amount: 0, period_month: fallbackPeriodMonth, period_year: fallbackPeriodYear, travel_days_effective: 0, per_day_attendance: 0, per_day_travel: 0, reason: "Fitur tunjangan perjalanan dinas dinonaktifkan." };
  }
  const perDayTravel = Number(travelCfg.per_day_amount) || 0;

  const attCfg = (attCfgRes.data?.value as any) || {};
  const maxAttendance = Number(attCfg.max_amount) || 0;
  const cutoffDay = Number(attCfg.cutoff_day) || 21;
  const excludedIds: string[] = Array.isArray(attCfg.excluded_employee_ids) ? attCfg.excluded_employee_ids : [];
  const attendanceEnabled = attCfg.enabled !== false;
  const userExcludedFromAttendance = excludedIds.includes(userId);

  const holidays: { date: string }[] = (holidayRes.data?.value as any)?.holidays || [];
  const holidaySet = new Set(holidays.map((h) => h.date));

  // 2. Kelompokkan hari kerja efektif trip per periode payroll (cut-off based)
  const tripDays = eachDayOfInterval({ start, end }).filter((d) => {
    const ds = format(d, "yyyy-MM-dd");
    return !isWeekend(ds) && !holidaySet.has(ds);
  });
  const totalTravelDays = tripDays.length;

  const grouped = new Map<string, { month: number; year: number; days: number }>();
  for (const d of tripDays) {
    const { month, year } = payrollPeriodOf(d, cutoffDay);
    const key = `${year}-${month}`;
    const cur = grouped.get(key) || { month, year, days: 0 };
    cur.days += 1;
    grouped.set(key, cur);
  }

  if (grouped.size === 0) {
    return { ok: true, amount: 0, period_month: fallbackPeriodMonth, period_year: fallbackPeriodYear, travel_days_effective: 0, per_day_attendance: 0, per_day_travel: perDayTravel, splits: [] };
  }

  let grandTotal = 0;
  const splits: NonNullable<BusinessTravelAllowanceResult["splits"]> = [];
  let lastPerDayAttendance = 0;

  for (const { month: pm, year: py, days } of grouped.values()) {
    // Per-day attendance allowance untuk periode ini
    const workingDays = workingDaysOfPeriod(pm, py, cutoffDay, holidaySet);
    let perDayAttendance = 0;
    if (attendanceEnabled && !userExcludedFromAttendance && workingDays > 0 && maxAttendance > 0) {
      perDayAttendance = maxAttendance / workingDays;
    }
    lastPerDayAttendance = perDayAttendance;

    const perDayDiff = Math.max(0, perDayTravel - perDayAttendance);
    const amount = Math.round(perDayDiff * days);

    if (amount <= 0) {
      splits.push({ period_month: pm, period_year: py, days, amount: 0 });
      continue;
    }

    // Cek payroll period finalized → lewati (jangan ubah data final)
    const { data: existingPeriod } = await supabase
      .from("payroll_periods")
      .select("id, status")
      .eq("month", pm)
      .eq("year", py)
      .maybeSingle();

    if (existingPeriod?.status === "finalized") {
      splits.push({ period_month: pm, period_year: py, days, amount, skipped_reason: "Payroll periode ini sudah final. Buka kunci dulu, lalu generate ulang." });
      continue;
    }

    // Upsert override (accumulate)
    const { data: existingOverride } = await supabase
      .from("payroll_overrides")
      .select("id, tunjangan_perjalanan_dinas")
      .eq("user_id", userId)
      .eq("period_month", pm)
      .eq("period_year", py)
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
        period_month: pm,
        period_year: py,
        tunjangan_perjalanan_dinas: newValue,
      } as any);
    }

    // Mirror ke payroll row bila sudah ada
    if (existingPeriod?.id) {
      await supabase
        .from("payroll")
        .update({ tunjangan_perjalanan_dinas: newValue } as any)
        .eq("user_id", userId)
        .eq("period_id", existingPeriod.id);
    }

    grandTotal += amount;
    splits.push({ period_month: pm, period_year: py, days, amount });
  }

  // Periode "utama" = periode dengan jumlah hari terbanyak (untuk kompatibilitas pemanggil lama)
  const primary = [...splits].sort((a, b) => b.days - a.days)[0];

  return {
    ok: true,
    amount: grandTotal,
    period_month: primary?.period_month ?? fallbackPeriodMonth,
    period_year: primary?.period_year ?? fallbackPeriodYear,
    travel_days_effective: totalTravelDays,
    per_day_attendance: lastPerDayAttendance,
    per_day_travel: perDayTravel,
    splits,
    reason: splits.find((s) => s.skipped_reason)?.skipped_reason,
  };
}
