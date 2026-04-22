import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, FileSpreadsheet, FileText, Calculator } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isWeekend } from "@/hooks/usePolicySettings";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { exportToExcelFile } from "@/lib/excelExport";

interface AllowanceConfig {
  max_amount: number;
  work_hours_per_day: number;
  excluded_employee_ids: string[];
  enabled: boolean;
  cutoff_day: number;
}

interface Holiday {
  id: string;
  name: string;
  date: string;
}

interface EmployeeAllowance {
  id: string;
  full_name: string;
  jabatan: string;
  departemen: string;
  nik: string;
  total_working_days: number;
  days_present: number;
  days_late: number;
  total_late_hours: number;
  days_early_leave: number;
  total_early_leave_hours: number;
  base_allowance: number;
  late_deduction: number;
  early_leave_deduction: number;
  final_allowance: number;
  excluded: boolean;
}

const loadImageAsBase64 = (src: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = src;
  });

export default function AttendanceAllowanceReport() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [config, setConfig] = useState<AllowanceConfig | null>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [results, setResults] = useState<EmployeeAllowance[]>([]);
  const [workHours, setWorkHours] = useState<any>(null);
  const [periodInfo, setPeriodInfo] = useState<{ totalDays: number; weekendDays: number; holidayDays: number; holidayNames: string[]; workingDays: number } | null>(null);

  useEffect(() => {
    fetchConfig();
    fetchHolidays();
  }, []);

  const fetchConfig = async () => {
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "attendance_allowance")
      .maybeSingle();
    if (data?.value) {
      setConfig(data.value as any);
    }
  };

  const fetchHolidays = async () => {
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "overtime_policy")
      .maybeSingle();
    if (data?.value) {
      const val = data.value as any;
      setHolidays(val.holidays || []);
    }
  };

  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = format(d, "yyyy-MM");
      const cutoff = config?.cutoff_day || 21;
      const periodEnd = cutoff - 1 || 28;
      const label = `${format(d, "MMMM yyyy", { locale: idLocale })} (Tgl ${cutoff} ${format(new Date(d.getFullYear(), d.getMonth() - 1), "MMM", { locale: idLocale })} - ${periodEnd} ${format(d, "MMM", { locale: idLocale })})`;
      options.push({ value, label });
    }
    return options;
  }, [config?.cutoff_day]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val);

  const calculateAllowances = async () => {
    if (!config) {
      toast.error("Konfigurasi tunjangan kehadiran belum diatur");
      return;
    }

    setCalculating(true);
    try {
      const [year, month] = selectedMonth.split("-").map(Number);
      const cutoffDay = config.cutoff_day || 21;
      
      // Cut-off period: cutoff_day of previous month to (cutoff_day - 1) of selected month
      const periodStart = new Date(year, month - 2, cutoffDay); // e.g., 21 Jan
      const periodEndDay = cutoffDay - 1 || 28;
      const periodEnd = new Date(year, month - 1, periodEndDay); // e.g., 20 Feb

      // Calculate working days (excluding weekends and holidays)
      const allDays = eachDayOfInterval({ start: periodStart, end: periodEnd });
      const holidayDates = new Set(holidays.map((h) => h.date));
      const workingDays = allDays.filter((d) => {
        const dateStr = format(d, "yyyy-MM-dd");
        return !isWeekend(dateStr) && !holidayDates.has(dateStr);
      });
      const totalWorkingDays = workingDays.length;

      // Calculate period info for display
      const weekendDays = allDays.filter((d) => isWeekend(format(d, "yyyy-MM-dd"))).length;
      const holidaysInPeriod = allDays.filter((d) => {
        const ds = format(d, "yyyy-MM-dd");
        return holidayDates.has(ds) && !isWeekend(ds);
      });
      const holidayNames = holidaysInPeriod.map((d) => {
        const ds = format(d, "yyyy-MM-dd");
        const h = holidays.find((hol) => hol.date === ds);
        return h ? `${h.name} (${format(d, "dd MMM")})` : format(d, "dd MMM");
      });
      setPeriodInfo({
        totalDays: allDays.length,
        weekendDays,
        holidayDays: holidaysInPeriod.length,
        holidayNames,
        workingDays: totalWorkingDays,
      });

      // Fetch work hours for late calculation
      const { data: whData } = await supabase.rpc("get_work_hours");
      const whParsed = whData as Record<string, any> | null;
      setWorkHours(whParsed);
      const checkInEnd = whParsed?.check_in_end || "08:00";
      const lateTolerance = whParsed?.late_tolerance_minutes || 0;

      // Parse check-in deadline + tolerance
      const [deadlineH, deadlineM] = checkInEnd.split(":").map(Number);
      const deadlineTotalMinutes = deadlineH * 60 + deadlineM + lateTolerance;

      // Fetch admin user IDs to exclude
      const { data: adminRoles } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      const adminIds = new Set((adminRoles || []).map((r) => r.user_id));

      // Fetch all employees
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, jabatan, departemen, nik")
        .order("full_name");

      // Get checkout boundary for early departure calculation
      const checkOutStart = whParsed?.check_out_start || "17:00";
      const earlyLeaveTolerance = whParsed?.early_leave_tolerance_minutes || 0;
      const [checkOutH, checkOutM] = checkOutStart.split(":").map(Number);
      const checkOutTotalMinutes = checkOutH * 60 + checkOutM - earlyLeaveTolerance;

      // Check for special work hours that may override for specific dates
      const { data: specialWhData } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "special_work_hours")
        .maybeSingle();
      const specialPeriods = (specialWhData?.value as any)?.periods || [];

      // Check if Friday-specific work hours are enabled
      const fridayEnabled = whParsed?.friday_enabled || false;
      const fridayCheckOutStart = whParsed?.friday_check_out_start || "16:00";
      const [fridayOutH, fridayOutM] = fridayCheckOutStart.split(":").map(Number);
      const fridayCheckOutMinutes = fridayOutH * 60 + fridayOutM - earlyLeaveTolerance;

      // Dynamic check-in deadline per day (handles special periods like Ramadan)
      const getCheckInDeadlineForDate = (dateStr: string): number => {
        // First check special periods (e.g., Ramadan 08:30-15:00)
        for (const sp of specialPeriods) {
          if (sp.is_active && dateStr >= sp.start_date && dateStr <= sp.end_date) {
            const spCheckInEnd = sp.check_in_end || checkInEnd;
            const [h, m] = spCheckInEnd.split(":").map(Number);
            const tol = sp.late_tolerance_minutes || 0;
            return h * 60 + m + tol;
          }
        }
        // Normal work hours with tolerance
        return deadlineTotalMinutes;
      };

      const getCheckOutMinutesForDate = (dateStr: string): number => {
        // First check special periods (e.g., Ramadan)
        for (const sp of specialPeriods) {
          if (sp.is_active && dateStr >= sp.start_date && dateStr <= sp.end_date) {
            const [h, m] = (sp.check_out_start || "17:00").split(":").map(Number);
            const tol = sp.early_leave_tolerance_minutes || 0;
            return h * 60 + m - tol;
          }
        }
        // Then check if it's Friday with special Friday hours
        const dayOfWeek = new Date(dateStr).getDay();
        if (fridayEnabled && dayOfWeek === 5) {
          return fridayCheckOutMinutes;
        }
        return checkOutTotalMinutes;
      };

      // Fetch attendance for the month (include check_out_time for early departure)
      const { data: attendanceData } = await supabase
        .from("attendance")
        .select("user_id, check_in_time, check_out_time, status")
        .gte("check_in_time", format(periodStart, "yyyy-MM-dd'T'00:00:00"))
        .lte("check_in_time", format(periodEnd, "yyyy-MM-dd'T'23:59:59"));

      // Group attendance by user
      const attendanceByUser = new Map<string, { present: number; late: number; totalLateHours: number; earlyLeave: number; totalEarlyLeaveHours: number }>();

      for (const record of attendanceData || []) {
        const userId = record.user_id;
        if (!attendanceByUser.has(userId)) {
          attendanceByUser.set(userId, { present: 0, late: 0, totalLateHours: 0, earlyLeave: 0, totalEarlyLeaveHours: 0 });
        }
        const userAtt = attendanceByUser.get(userId)!;

        // Skip attendance on holidays — holidays are not working days,
        // so attendance on those days should NOT count for allowance
        if (record.check_in_time) {
          const attendanceDateStr = format(new Date(record.check_in_time), "yyyy-MM-dd");
          if (holidayDates.has(attendanceDateStr)) {
            continue;
          }
        }

        // Count as present only if BOTH check_in and check_out are filled
        // If either is missing, the day's allowance value is 0
        const hasCheckIn = !!record.check_in_time;
        const hasCheckOut = !!record.check_out_time;
        const isValidAttendance = hasCheckIn && hasCheckOut;

        if (isValidAttendance && (record.status === "hadir" || record.status === "terlambat" || record.status === "pulang_cepat")) {
          userAtt.present += 1;
        }

        // Calculate lateness using dynamic deadline per day
        if (record.status === "terlambat" && record.check_in_time) {
          const checkInDate = new Date(record.check_in_time);
          const dateStr = format(checkInDate, "yyyy-MM-dd");
          const checkInMinutes = checkInDate.getHours() * 60 + checkInDate.getMinutes();
          const dailyDeadline = getCheckInDeadlineForDate(dateStr);
          const lateMinutes = Math.max(0, checkInMinutes - dailyDeadline);
          const lateHours = Math.ceil(lateMinutes / 60); // pembulatan ke atas per jam
          userAtt.late += 1;
          userAtt.totalLateHours += lateHours;
        }

        // Calculate early departure
        if (record.status === "pulang_cepat" && record.check_out_time) {
          const checkOutDate = new Date(record.check_out_time);
          const checkOutMinutes = checkOutDate.getHours() * 60 + checkOutDate.getMinutes();
          const dateStr = format(checkOutDate, "yyyy-MM-dd");
          const expectedCheckOut = getCheckOutMinutesForDate(dateStr);
          const earlyMinutes = Math.max(0, expectedCheckOut - checkOutMinutes);
          if (earlyMinutes > 0) {
            const earlyHours = Math.ceil(earlyMinutes / 60); // pembulatan ke atas per jam
            userAtt.earlyLeave += 1;
            userAtt.totalEarlyLeaveHours += earlyHours;
          }
        }
      }

      // Calculate allowance per employee
      const ratePerDay = totalWorkingDays > 0 ? config.max_amount / totalWorkingDays : 0;
      const ratePerHour = config.work_hours_per_day > 0 ? ratePerDay / config.work_hours_per_day : 0;

      const employeeResults: EmployeeAllowance[] = (profiles || [])
        .filter((p) => !adminIds.has(p.id))
        .map((p) => {
          const isExcluded = config.excluded_employee_ids.includes(p.id);
          const att = attendanceByUser.get(p.id) || { present: 0, late: 0, totalLateHours: 0, earlyLeave: 0, totalEarlyLeaveHours: 0 };

          const baseAllowance = isExcluded ? 0 : ratePerDay * att.present;
          const lateDeduction = isExcluded ? 0 : ratePerHour * att.totalLateHours;
          const earlyLeaveDeduction = isExcluded ? 0 : ratePerHour * att.totalEarlyLeaveHours;
          const finalAllowance = Math.max(0, Math.round(baseAllowance - lateDeduction - earlyLeaveDeduction));

          return {
            id: p.id,
            full_name: p.full_name,
            jabatan: p.jabatan,
            departemen: p.departemen,
            nik: p.nik,
            total_working_days: totalWorkingDays,
            days_present: att.present,
            days_late: att.late,
            total_late_hours: att.totalLateHours,
            days_early_leave: att.earlyLeave,
            total_early_leave_hours: att.totalEarlyLeaveHours,
            base_allowance: Math.round(baseAllowance),
            late_deduction: Math.round(lateDeduction),
            early_leave_deduction: Math.round(earlyLeaveDeduction),
            final_allowance: finalAllowance,
            excluded: isExcluded,
          };
        });

      setResults(employeeResults);
      toast.success("Perhitungan selesai");
    } catch (error) {
      console.error("Error calculating:", error);
      toast.error("Gagal menghitung tunjangan");
    } finally {
      setCalculating(false);
    }
  };

  const exportToExcel = async () => {
    if (results.length === 0) return;

    const [year, month] = selectedMonth.split("-").map(Number);
    const cutoffDay = config?.cutoff_day || 21;
    const periodEndDay = cutoffDay - 1 || 28;
    const prevMonth = new Date(year, month - 2);
    const curMonth = new Date(year, month - 1);
    const monthLabel = `${cutoffDay} ${format(prevMonth, "MMMM", { locale: idLocale })} - ${periodEndDay} ${format(curMonth, "MMMM yyyy", { locale: idLocale })}`;

    const wsData = results.map((r, idx) => ({
      "No.": idx + 1,
      "NIK": r.nik,
      "Nama Karyawan": r.full_name,
      "Jabatan": r.jabatan,
      "Departemen": r.departemen,
      "Hari Kerja": r.total_working_days,
      "Hari Hadir": r.days_present,
      "Hari Terlambat": r.days_late,
      "Jam Terlambat": r.total_late_hours,
      "Hari Pulang Cepat": r.days_early_leave,
      "Jam Pulang Cepat": r.total_early_leave_hours,
      "Base Tunjangan": r.excluded ? "-" : r.base_allowance,
      "Potongan Terlambat": r.excluded ? "-" : r.late_deduction,
      "Potongan Pulang Cepat": r.excluded ? "-" : r.early_leave_deduction,
      "Tunjangan Kehadiran": r.excluded ? "Dikecualikan" : r.final_allowance,
    }));

    await exportToExcelFile(wsData, "Tunjangan Kehadiran", `Tunjangan_Kehadiran_${selectedMonth}.xlsx`);
    toast.success("File Excel berhasil diunduh");
  };

  const exportToPDF = async () => {
    if (results.length === 0) return;

    setLoading(true);
    try {
      const [year, month] = selectedMonth.split("-").map(Number);
      const cutoffDay = config?.cutoff_day || 21;
      const periodEndDay = cutoffDay - 1 || 28;
      const prevMonth = new Date(year, month - 2);
      const curMonth = new Date(year, month - 1);
      const monthLabel = `${cutoffDay} ${format(prevMonth, "MMMM", { locale: idLocale })} - ${periodEndDay} ${format(curMonth, "MMMM yyyy", { locale: idLocale })}`;

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pw = doc.internal.pageSize.getWidth();
      const ph = doc.internal.pageSize.getHeight();

      // Kemika brand colors (matching payroll PDF standard)
      const GREEN: [number, number, number] = [0, 135, 81];
      const GRAY_TEXT: [number, number, number] = [80, 80, 80];

      // ===== Green header bar with logo =====
      doc.setFillColor(...GREEN);
      doc.rect(0, 0, pw, 18, "F");

      // Logo on the left of the green bar
      try {
        const logoBase64 = await loadImageAsBase64("/logo.png");
        doc.addImage(logoBase64, "PNG", 6, 2, 14, 14);
      } catch {}

      // Title centered in the green bar
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text("Laporan Tunjangan Kehadiran", pw / 2, 8, { align: "center" });

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`Periode: ${monthLabel}`, 22, 15);
      doc.text("PT. KEMIKA KARYA PRATAMA", pw - 8, 15, { align: "right" });

      // Reset text color for body
      doc.setTextColor(30, 30, 30);

      // ===== Summary line =====
      const ratePerDay = results[0]?.total_working_days > 0
        ? (config?.max_amount || 0) / results[0].total_working_days
        : 0;
      const ratePerHour = (config?.work_hours_per_day || 8) > 0
        ? ratePerDay / (config?.work_hours_per_day || 8)
        : 0;

      doc.setFontSize(9);
      doc.text(
        `Tunjangan Maks: ${formatCurrency(config?.max_amount || 0)}  |  Hari Kerja: ${results[0]?.total_working_days}  |  Tarif/hari: ${formatCurrency(ratePerDay)}  |  Tarif potongan/jam: ${formatCurrency(ratePerHour)}`,
        8,
        26,
      );

      // ===== Table =====
      // Mangkir = Hari Kerja - (Hadir + Telat + Pulang Cepat)
      // Catatan: days_present sudah memuat hadir+telat+pulang_cepat yang valid (check-in & check-out)
      // sehingga mangkir mencerminkan hari kerja tanpa absensi tercatat (tidak termasuk cuti/sakit/izin/dinas yang sudah disetujui).
      const calcMangkir = (r: EmployeeAllowance) =>
        Math.max(0, r.total_working_days - r.days_present);

      const tableData = results.map((r, idx) => [
        idx + 1,
        r.nik,
        r.full_name,
        r.jabatan,
        r.total_working_days,
        r.days_present,
        r.excluded ? "-" : calcMangkir(r),
        r.days_late,
        r.total_late_hours,
        r.days_early_leave,
        r.total_early_leave_hours,
        r.excluded ? "-" : formatCurrency(r.base_allowance),
        r.excluded ? "-" : formatCurrency(r.late_deduction),
        r.excluded ? "-" : formatCurrency(r.early_leave_deduction),
        r.excluded ? "Dikecualikan" : formatCurrency(r.final_allowance),
      ]);

      const totalAllowance = results.reduce((s, r) => s + (r.excluded ? 0 : r.final_allowance), 0);
      const totalMangkir = results.reduce((s, r) => s + (r.excluded ? 0 : calcMangkir(r)), 0);
      const totalPresent = results.reduce((s, r) => s + (r.excluded ? 0 : r.days_present), 0);
      tableData.push(["", "", "", "TOTAL", "", totalPresent, totalMangkir, "", "", "", "", "", "", "", formatCurrency(totalAllowance)]);

      autoTable(doc, {
        startY: 32,
        head: [[
          "No", "NIK", "Nama", "Jabatan",
          "H.Kerja", "Hadir", "Mangkir",
          "Telat", "Jam Telat", "P.Cepat", "Jam P.Cepat",
          "Base", "Pot. Telat", "Pot. P.Cepat", "Tunjangan",
        ]],
        body: tableData,
        styles: { fontSize: 7 },
        headStyles: { fillColor: GREEN, textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [245, 250, 247] },
        margin: { left: 8, right: 8 },
        columnStyles: {
          6: { textColor: [200, 50, 50], fontStyle: "bold" },
        },
      });

      // ===== Footer (matches payroll PDF style) =====
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setDrawColor(...GREEN);
        doc.setLineWidth(0.5);
        doc.line(8, ph - 10, pw - 8, ph - 10);

        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...GRAY_TEXT);
        doc.text("Dokumen ini dicetak melalui sistem digital dan tidak memerlukan tanda tangan sebagai validasi.", 8, ph - 6);
        doc.text(`PT. Kemika Karya Pratama — Laporan Tunjangan Kehadiran ${monthLabel}`, pw / 2, ph - 6, { align: "center" });
        doc.text(`Halaman ${i} / ${pageCount}`, pw - 8, ph - 6, { align: "right" });
      }

      doc.save(`Tunjangan_Kehadiran_${selectedMonth}.pdf`);
      toast.success("File PDF berhasil diunduh");
    } catch (error) {
      toast.error("Gagal export PDF");
    } finally {
      setLoading(false);
    }
  };

  const totalAllowance = results.reduce((s, r) => s + (r.excluded ? 0 : r.final_allowance), 0);
  const totalDeduction = results.reduce((s, r) => s + (r.excluded ? 0 : r.late_deduction + r.early_leave_deduction), 0);
  const totalEarlyDeduction = results.reduce((s, r) => s + (r.excluded ? 0 : r.early_leave_deduction), 0);
  const totalLateDeduction = results.reduce((s, r) => s + (r.excluded ? 0 : r.late_deduction), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fadeIn">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/reports")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Laporan Tunjangan Kehadiran</h1>
            <p className="text-muted-foreground text-sm">Perhitungan tunjangan kehadiran bulanan per karyawan</p>
          </div>
        </div>

        {/* Config */}
        <Card>
          <CardHeader>
            <CardTitle>Pilih Periode</CardTitle>
            <CardDescription>Pilih bulan untuk menghitung tunjangan kehadiran (sistem cut-off tgl {config?.cutoff_day || 21})</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
              <div className="space-y-2">
                <Label>Bulan</Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={calculateAllowances} disabled={calculating}>
                {calculating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Calculator className="mr-2 h-4 w-4" />
                )}
                Hitung Tunjangan
              </Button>
            </div>

            {config && (
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">Maks: {formatCurrency(config.max_amount)}</Badge>
                <Badge variant="outline">{config.work_hours_per_day} jam/hari</Badge>
                <Badge variant="outline">Cut-off: Tgl {config.cutoff_day}</Badge>
                <Badge variant="outline">{config.excluded_employee_ids.length} karyawan dikecualikan</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        {results.length > 0 && (
          <>
            {/* Period Info */}
            {periodInfo && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Total Hari: {periodInfo.totalDays}</Badge>
                      <Badge variant="outline">Weekend: {periodInfo.weekendDays}</Badge>
                      <Badge variant="secondary">Hari Libur: {periodInfo.holidayDays}</Badge>
                      <Badge className="bg-primary text-primary-foreground">Hari Kerja: {periodInfo.workingDays}</Badge>
                    </div>
                  </div>
                  {periodInfo.holidayDays > 0 && (
                    <div className="mt-3 text-xs text-muted-foreground">
                      <span className="font-medium">Hari libur dalam periode:</span>{" "}
                      {periodInfo.holidayNames.join(", ")}
                    </div>
                  )}
                  {periodInfo.holidayDays === 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">Tidak ada hari libur nasional dalam periode ini.</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Summary */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Total Karyawan</p>
                  <p className="text-2xl font-bold">{results.filter((r) => !r.excluded).length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Potongan Terlambat</p>
                  <p className="text-2xl font-bold text-destructive">{formatCurrency(totalLateDeduction)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Potongan Pulang Cepat</p>
                  <p className="text-2xl font-bold text-destructive">{formatCurrency(totalEarlyDeduction)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Total Tunjangan</p>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(totalAllowance)}</p>
                </CardContent>
              </Card>
            </div>

            {/* Table */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle>Detail Perhitungan</CardTitle>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={exportToExcel}>
                      <FileSpreadsheet className="mr-2 h-4 w-4" />
                      Excel
                    </Button>
                    <Button size="sm" variant="outline" onClick={exportToPDF} disabled={loading}>
                      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                      PDF
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">No</TableHead>
                        <TableHead>Nama</TableHead>
                        <TableHead>Jabatan</TableHead>
                        <TableHead className="text-center">Hari Kerja</TableHead>
                        <TableHead className="text-center">Hadir</TableHead>
                        <TableHead className="text-center">Terlambat</TableHead>
                        <TableHead className="text-center">Jam Telat</TableHead>
                        <TableHead className="text-center">P. Cepat</TableHead>
                        <TableHead className="text-center">Jam P. Cepat</TableHead>
                        <TableHead className="text-right">Base</TableHead>
                        <TableHead className="text-right">Pot. Telat</TableHead>
                        <TableHead className="text-right">Pot. P.Cepat</TableHead>
                        <TableHead className="text-right">Tunjangan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.map((r, idx) => (
                        <TableRow key={r.id} className={r.excluded ? "opacity-50" : ""}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell className="font-medium">{r.full_name}</TableCell>
                          <TableCell>{r.jabatan}</TableCell>
                          <TableCell className="text-center">{r.total_working_days}</TableCell>
                          <TableCell className="text-center">{r.days_present}</TableCell>
                          <TableCell className="text-center">
                            {r.days_late > 0 ? (
                              <Badge variant="destructive" className="text-xs">{r.days_late}</Badge>
                            ) : (
                              "0"
                            )}
                          </TableCell>
                          <TableCell className="text-center">{r.total_late_hours}</TableCell>
                          <TableCell className="text-center">
                            {r.days_early_leave > 0 ? (
                              <Badge variant="destructive" className="text-xs">{r.days_early_leave}</Badge>
                            ) : (
                              "0"
                            )}
                          </TableCell>
                          <TableCell className="text-center">{r.total_early_leave_hours}</TableCell>
                          <TableCell className="text-right">
                            {r.excluded ? "-" : formatCurrency(r.base_allowance)}
                          </TableCell>
                          <TableCell className="text-right text-destructive">
                            {r.excluded ? "-" : r.late_deduction > 0 ? `-${formatCurrency(r.late_deduction)}` : "-"}
                          </TableCell>
                          <TableCell className="text-right text-destructive">
                            {r.excluded ? "-" : r.early_leave_deduction > 0 ? `-${formatCurrency(r.early_leave_deduction)}` : "-"}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {r.excluded ? (
                              <Badge variant="secondary">Dikecualikan</Badge>
                            ) : (
                              formatCurrency(r.final_allowance)
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Total row */}
                      <TableRow className="font-bold border-t-2">
                        <TableCell colSpan={9}>TOTAL</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(results.reduce((s, r) => s + (r.excluded ? 0 : r.base_allowance), 0))}
                        </TableCell>
                        <TableCell className="text-right text-destructive">
                          -{formatCurrency(totalLateDeduction)}
                        </TableCell>
                        <TableCell className="text-right text-destructive">
                          -{formatCurrency(totalEarlyDeduction)}
                        </TableCell>
                        <TableCell className="text-right text-primary">
                          {formatCurrency(totalAllowance)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
