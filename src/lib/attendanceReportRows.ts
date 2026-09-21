import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { isAttendanceExempt } from "@/lib/employeeFilters";
import { formatAttendanceStatus, formatLeaveType } from "@/lib/statusUtils";

export interface AttendanceReportRow {
  date: string;
  nik: string;
  name: string;
  department: string;
  checkIn: string;
  checkOut: string;
  status: string;
  durationMinutes: number | null;
}

const isNonWorkingDay = (d: Date, holidayDates: Set<string>): boolean => {
  const day = d.getDay();
  if (day === 0 || day === 6) return true;
  return holidayDates.has(format(d, "yyyy-MM-dd"));
};

const fetchHolidayDates = async (): Promise<Set<string>> => {
  try {
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "overtime_policy")
      .maybeSingle();
    const value = data?.value as any;
    const holidays = value && typeof value === "object" ? value.holidays || [] : [];
    return new Set(holidays.map((h: any) => h.date));
  } catch {
    return new Set();
  }
};

/**
 * Bangun baris laporan absensi: satu karyawan + satu tanggal = satu baris.
 * Prioritas: absensi > dinas > cuti/izin/sakit > "Tidak Hadir".
 * Lupa Absen tidak membuat baris tambahan bila tanggalnya sudah ada absensinya.
 */
export async function buildAttendanceReportRows(params: {
  startDate: string;
  endDate: string;
  department: string;
  adminUserIds: Set<string>;
}): Promise<AttendanceReportRow[]> {
  const { startDate, endDate, department, adminUserIds } = params;

  const [attRes, leaveRes, travelRes, profilesRes, holidayDates] = await Promise.all([
    supabase
      .from("attendance")
      .select("*")
      .gte("check_in_time", `${startDate}T00:00:00`)
      .lte("check_in_time", `${endDate}T23:59:59`),
    supabase
      .from("leave_requests")
      .select("*")
      .eq("status", "approved")
      .lte("start_date", endDate)
      .gte("end_date", startDate),
    supabase
      .from("business_travel_requests")
      .select("*")
      .eq("status", "approved")
      .lte("start_date", endDate)
      .gte("end_date", startDate),
    supabase
      .from("profiles")
      .select("id, full_name, departemen, nik, status, join_date, resign_date"),
    fetchHolidayDates(),
  ]);

  if (attRes.error) throw attRes.error;
  if (leaveRes.error) throw leaveRes.error;
  if (travelRes.error) throw travelRes.error;
  if (profilesRes.error) throw profilesRes.error;

  const profiles = (profilesRes.data || []).filter(
    (p: any) =>
      !adminUserIds.has(p.id) &&
      !isAttendanceExempt(p.departemen) &&
      p.status === "Active" &&
      (department === "all" || p.departemen === department),
  );
  const profileMap = new Map(profiles.map((p: any) => [p.id, p]));

  // key: `${user_id}|${date}`
  const rows = new Map<string, AttendanceReportRow>();
  const baseRow = (p: any, date: string): AttendanceReportRow => ({
    date,
    nik: p.nik || "-",
    name: p.full_name || "-",
    department: p.departemen || "-",
    checkIn: "-",
    checkOut: "-",
    status: "-",
    durationMinutes: null,
  });

  const rangeStart = new Date(`${startDate}T00:00:00`);
  const rangeEnd = new Date(`${endDate}T00:00:00`);

  const eachWorkingDay = (start: string, end: string, cb: (dateStr: string) => void) => {
    const s = new Date(`${start}T00:00:00`) < rangeStart ? rangeStart : new Date(`${start}T00:00:00`);
    const e = new Date(`${end}T00:00:00`) > rangeEnd ? rangeEnd : new Date(`${end}T00:00:00`);
    for (const d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      if (isNonWorkingDay(new Date(d), holidayDates)) continue;
      cb(format(new Date(d), "yyyy-MM-dd"));
    }
  };

  // 1. Absensi (gabungkan bila satu tanggal ada beberapa record)
  for (const rec of attRes.data || []) {
    const p = profileMap.get(rec.user_id);
    if (!p) continue;
    const checkIn = new Date(rec.check_in_time);
    const dateStr = format(checkIn, "yyyy-MM-dd");
    const key = `${rec.user_id}|${dateStr}`;
    const existing = rows.get(key);
    if (!existing) {
      rows.set(key, {
        ...baseRow(p, dateStr),
        checkIn: format(checkIn, "HH:mm"),
        checkOut: rec.check_out_time ? format(new Date(rec.check_out_time), "HH:mm") : "-",
        status: formatAttendanceStatus(rec.status),
        durationMinutes: rec.duration_minutes ?? null,
      });
      continue;
    }
    // jam masuk paling awal, jam keluar paling akhir, durasi diakumulasi
    if (format(checkIn, "HH:mm") < existing.checkIn) {
      existing.checkIn = format(checkIn, "HH:mm");
      existing.status = formatAttendanceStatus(rec.status);
    }
    if (rec.check_out_time) {
      const out = format(new Date(rec.check_out_time), "HH:mm");
      if (existing.checkOut === "-" || out > existing.checkOut) existing.checkOut = out;
    }
    if (rec.duration_minutes) {
      existing.durationMinutes = (existing.durationMinutes || 0) + rec.duration_minutes;
    }
  }

  // 2. Dinas
  for (const travel of travelRes.data || []) {
    const p = profileMap.get(travel.user_id);
    if (!p) continue;
    eachWorkingDay(travel.start_date, travel.end_date, (dateStr) => {
      const key = `${travel.user_id}|${dateStr}`;
      if (rows.has(key)) return;
      rows.set(key, { ...baseRow(p, dateStr), status: "Dinas" });
    });
  }

  // 3. Cuti / Izin / Sakit / Lupa Absen
  for (const leave of leaveRes.data || []) {
    const p = profileMap.get(leave.user_id);
    if (!p) continue;
    eachWorkingDay(leave.start_date, leave.end_date, (dateStr) => {
      const key = `${leave.user_id}|${dateStr}`;
      if (rows.has(key)) return; // termasuk lupa_absen yang tanggalnya sudah terisi
      rows.set(key, { ...baseRow(p, dateStr), status: formatLeaveType(leave.leave_type) });
    });
  }

  // 4. Hari kerja tanpa data → Tidak Hadir
  for (const p of profiles as any[]) {
    const joinDate = p.join_date ? new Date(`${p.join_date}T00:00:00`) : null;
    const resignDate = p.resign_date ? new Date(`${p.resign_date}T00:00:00`) : null;
    for (const d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
      const day = new Date(d);
      if (isNonWorkingDay(day, holidayDates)) continue;
      if (joinDate && day < joinDate) continue;
      if (resignDate && day > resignDate) continue;
      const dateStr = format(day, "yyyy-MM-dd");
      const key = `${p.id}|${dateStr}`;
      if (rows.has(key)) continue;
      rows.set(key, { ...baseRow(p, dateStr), status: formatAttendanceStatus("tidak_hadir") });
    }
  }

  return [...rows.values()].sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.name.localeCompare(b.name);
  });
}
