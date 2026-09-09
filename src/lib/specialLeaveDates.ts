/**
 * Perhitungan tanggal izin khusus berbasis HARI KERJA.
 * Sabtu, Minggu, dan hari libur nasional dilewati (tidak memotong jatah),
 * sehingga karyawan tetap mendapat jumlah hari kerja penuh sesuai jenis izinnya.
 */

export interface HolidayLike {
  date: string; // YYYY-MM-DD
}

const toDateString = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const isNonWorkingDay = (date: Date, holidayDates: Set<string>) => {
  const day = date.getDay();
  return day === 0 || day === 6 || holidayDates.has(toDateString(date));
};

/**
 * Kembalikan tanggal selesai (YYYY-MM-DD) agar rentang start..end
 * berisi tepat `workingDays` hari kerja. Jika tanggal mulai jatuh pada
 * hari libur, hari kerja pertama dicari setelahnya.
 */
export function getSpecialLeaveEndDate(
  startDate: string,
  workingDays: number,
  holidays: HolidayLike[] = []
): string {
  if (!startDate || workingDays <= 0) return "";
  const [y, m, d] = startDate.split("-").map(Number);
  const cursor = new Date(y, (m || 1) - 1, d || 1);
  if (isNaN(cursor.getTime())) return "";

  const holidayDates = new Set(holidays.map((h) => h.date));
  let counted = 0;
  let lastWorking = new Date(cursor);
  let guard = 0;

  while (counted < workingDays && guard < 400) {
    if (!isNonWorkingDay(cursor, holidayDates)) {
      counted++;
      lastWorking = new Date(cursor);
    }
    if (counted < workingDays) cursor.setDate(cursor.getDate() + 1);
    guard++;
  }

  return toDateString(lastWorking);
}
