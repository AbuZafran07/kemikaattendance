import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { FileSpreadsheet, FileText, Loader2, ArrowLeft, Sparkles, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { exportToExcelFile } from "@/lib/excelExport";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import logoImage from "@/assets/logo.png";
import goldStarImage from "@/assets/gold-star.png";
import { formatAttendanceStatus } from "@/lib/statusUtils";
import logger from "@/lib/logger";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";

const loadImageAsBase64 = (src: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = src;
  });
};

interface EmployeeAttendanceData {
  employee: { id: string; full_name: string; nik: string; departemen: string };
  attendance: any[];
  leave: any[];
  travel: any[];
  summary: {
    hadir: number;
    terlambat: number;
    pulangCepat: number;
    cuti: number;
    dinas: number;
    totalDuration: number;
  };
  insight?: string;
  isGood?: boolean;
}

async function fetchHolidayDates(): Promise<Set<string>> {
  try {
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "overtime_policy")
      .maybeSingle();
    if (data?.value && typeof data.value === "object" && "holidays" in (data.value as any)) {
      const holidays = (data.value as any).holidays || [];
      return new Set(holidays.map((h: any) => h.date));
    }
  } catch (e) {
    console.error("Error fetching holidays:", e);
  }
  return new Set();
}

function isNonWorkingDay(d: Date, holidayDates: Set<string>): boolean {
  const day = d.getDay();
  if (day === 0 || day === 6) return true;
  const dateStr = format(d, "yyyy-MM-dd");
  return holidayDates.has(dateStr);
}

async function fetchEmployeeData(
  employeeId: string,
  startDate: string,
  endDate: string,
  employee: any,
  holidayDates: Set<string>
): Promise<EmployeeAttendanceData> {
  const [attRes, leaveRes, travelRes] = await Promise.all([
    supabase
      .from("attendance")
      .select("*")
      .eq("user_id", employeeId)
      .gte("check_in_time", `${startDate}T00:00:00`)
      .lte("check_in_time", `${endDate}T23:59:59`)
      .order("check_in_time", { ascending: false }),
    supabase
      .from("leave_requests")
      .select("*")
      .eq("user_id", employeeId)
      .eq("status", "approved")
      .lte("start_date", endDate)
      .gte("end_date", startDate),
    supabase
      .from("business_travel_requests")
      .select("*")
      .eq("user_id", employeeId)
      .eq("status", "approved")
      .lte("start_date", endDate)
      .gte("end_date", startDate),
  ]);

  const attendance = attRes.data || [];
  const leave = leaveRes.data || [];
  const travel = travelRes.data || [];

  const rangeStart = new Date(startDate);
  const rangeEnd = new Date(endDate);

  let totalLeaveDays = 0;
  leave.forEach((l: any) => {
    const s = new Date(l.start_date) < rangeStart ? rangeStart : new Date(l.start_date);
    const e = new Date(l.end_date) > rangeEnd ? rangeEnd : new Date(l.end_date);
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      if (!isNonWorkingDay(new Date(d), holidayDates)) totalLeaveDays++;
    }
  });

  let totalTravelDays = 0;
  travel.forEach((t: any) => {
    const s = new Date(t.start_date) < rangeStart ? rangeStart : new Date(t.start_date);
    const e = new Date(t.end_date) > rangeEnd ? rangeEnd : new Date(t.end_date);
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      if (!isNonWorkingDay(new Date(d), holidayDates)) totalTravelDays++;
    }
  });

  // Break down leave by type
  let cutiTahunan = 0, sakit = 0, izin = 0, lupaAbsen = 0;
  leave.forEach((l: any) => {
    const s = new Date(l.start_date) < rangeStart ? rangeStart : new Date(l.start_date);
    const e = new Date(l.end_date) > rangeEnd ? rangeEnd : new Date(l.end_date);
    let days = 0;
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      if (!isNonWorkingDay(new Date(d), holidayDates)) days++;
    }
    if (l.leave_type === "cuti_tahunan") cutiTahunan += days;
    else if (l.leave_type === "sakit") sakit += days;
    else if (l.leave_type === "izin") izin += days;
    else if (l.leave_type === "lupa_absen") lupaAbsen += days;
  });

  return {
    employee,
    attendance,
    leave,
    travel,
    summary: {
      hadir: attendance.filter((r) => r.status === "hadir").length,
      terlambat: attendance.filter((r) => r.status === "terlambat").length,
      pulangCepat: attendance.filter((r) => r.status === "pulang_cepat").length,
      cuti: totalLeaveDays,
      cutiTahunan,
      sakit,
      izin,
      lupaAbsen,
      dinas: totalTravelDays,
      totalDuration: attendance.reduce((sum, r) => sum + (r.duration_minutes || 0), 0),
    },
  };
}

function formatRecords(data: EmployeeAttendanceData, startDate: string, endDate: string, holidayDates: Set<string>) {
  const rangeStart = new Date(startDate);
  const rangeEnd = new Date(endDate);

  const formattedAttendance = data.attendance.map((record: any) => ({
    tanggal: format(new Date(record.check_in_time), "yyyy-MM-dd"),
    checkIn: format(new Date(record.check_in_time), "HH:mm:ss"),
    checkOut: record.check_out_time ? format(new Date(record.check_out_time), "HH:mm:ss") : "-",
    durasi: record.duration_minutes ? `${record.duration_minutes} min` : "-",
    status: formatAttendanceStatus(record.status),
    keterangan: record.notes || "-",
  }));

  const formattedLeave: any[] = [];
  data.leave.forEach((leave: any) => {
    const start = new Date(leave.start_date) < rangeStart ? rangeStart : new Date(leave.start_date);
    const end = new Date(leave.end_date) > rangeEnd ? rangeEnd : new Date(leave.end_date);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (isNonWorkingDay(new Date(d), holidayDates)) continue;
      formattedLeave.push({
        tanggal: format(new Date(d), "yyyy-MM-dd"),
        checkIn: "-", checkOut: "-", durasi: "-",
        status: formatAttendanceStatus(leave.leave_type),
        keterangan: leave.reason || "-",
      });
    }
  });

  const formattedTravel: any[] = [];
  data.travel.forEach((travel: any) => {
    const start = new Date(travel.start_date) < rangeStart ? rangeStart : new Date(travel.start_date);
    const end = new Date(travel.end_date) > rangeEnd ? rangeEnd : new Date(travel.end_date);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (isNonWorkingDay(new Date(d), holidayDates)) continue;
      formattedTravel.push({
        tanggal: format(new Date(d), "yyyy-MM-dd"),
        checkIn: "-", checkOut: "-", durasi: "-",
        status: formatAttendanceStatus("dinas"),
        keterangan: `${travel.destination} - ${travel.purpose}`,
      });
    }
  });

  return [...formattedAttendance, ...formattedLeave, ...formattedTravel]
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal));
}

async function getAIInsight(
  employeeName: string,
  summary: EmployeeAttendanceData["summary"],
  periode: string
): Promise<{ insight: string; isGood: boolean }> {
  const maxRetries = 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[AI Insight] Attempt ${attempt + 1}:`, employeeName);
      const { data, error } = await supabase.functions.invoke("attendance-insight", {
        body: {
          employeeName,
          summary: {
            ...summary,
            totalJamKerja: `${Math.floor(summary.totalDuration / 60)} jam ${summary.totalDuration % 60} menit`,
            periode,
          },
        },
      });

      if (error) throw error;

      const cleanedInsight = typeof data?.insight === "string" ? data.insight.trim() : "";

      return {
        insight: cleanedInsight || "Tidak dapat menghasilkan insight.",
        isGood: data?.isGood === true,
      };
    } catch (e) {
      console.error(`[AI Insight] Attempt ${attempt + 1} failed:`, e);

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
        continue;
      }
    }
  }

  return { insight: "Insight tidak tersedia.", isGood: false };
}

export default function EmployeeReports() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [enableAI, setEnableAI] = useState(true);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");

  useEffect(() => {
    fetchEmployees();
  }, []);

  const EXCLUDED_DEPARTMENTS = ["BOD", "Komisaris"];

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, nik, departemen, status")
      .order("full_name");
    if (data) {
      const filtered = data.filter((e: any) => !EXCLUDED_DEPARTMENTS.includes(e.departemen) && e.status === "Active");
      setEmployees(filtered);
    }
  };

  const isAllEmployees = selectedEmployee === "all";

  const getTargetEmployees = () => {
    if (isAllEmployees) return employees;
    const emp = employees.find((e) => e.id === selectedEmployee);
    return emp ? [emp] : [];
  };

  const exportToExcel = async () => {
    if (!selectedEmployee || !startDate || !endDate) {
      toast({ title: "Data Belum Lengkap", description: "Pilih karyawan dan rentang tanggal", variant: "destructive" });
      return;
    }

    setLoading(true);
    setProgress(0);
    try {
      const holidayDates = await fetchHolidayDates();
      const targetEmployees = getTargetEmployees();
      const total = targetEmployees.length;

      if (isAllEmployees) {
        // All employees: one Excel file with multiple sheets or combined data
        const allRows: Record<string, any>[] = [];

        for (let i = 0; i < total; i++) {
          const emp = targetEmployees[i];
          setProgressText(`Mengambil data ${emp.full_name} (${i + 1}/${total})`);
          setProgress(((i + 1) / (total + (enableAI ? total : 0))) * 100);

          const empData = await fetchEmployeeData(emp.id, startDate, endDate, emp, holidayDates);
          const records = formatRecords(empData, startDate, endDate, holidayDates);

          records.forEach((r) => {
            allRows.push({
              "Nama Karyawan": emp.full_name,
              NIK: emp.nik,
              Departemen: emp.departemen,
              Tanggal: r.tanggal,
              "Check In": r.checkIn,
              "Check Out": r.checkOut,
              Durasi: r.durasi,
              Status: r.status,
              Keterangan: r.keterangan,
            });
          });
        }

        // AI insights sheet data
        let insightRows: Record<string, any>[] = [];
        if (enableAI) {
          for (let i = 0; i < total; i++) {
            const emp = targetEmployees[i];
            setProgressText(`Generating AI insight: ${emp.full_name} (${i + 1}/${total})`);
            setProgress(((total + i + 1) / (total * 2)) * 100);

            const empData = await fetchEmployeeData(emp.id, startDate, endDate, emp, holidayDates);
            const { insight, isGood } = await getAIInsight(emp.full_name, empData.summary, `${startDate} s/d ${endDate}`);

            insightRows.push({
              "Nama Karyawan": `${isGood ? "⭐ " : ""}${emp.full_name}`,
              NIK: emp.nik,
              Departemen: emp.departemen,
              "Hadir Tepat Waktu": empData.summary.hadir,
              Terlambat: empData.summary.terlambat,
              "Pulang Cepat": empData.summary.pulangCepat,
              Cuti: empData.summary.cuti,
              Dinas: empData.summary.dinas,
              "Total Jam Kerja": `${Math.floor(empData.summary.totalDuration / 60)}j ${empData.summary.totalDuration % 60}m`,
              Penilaian: isGood ? "⭐ Baik" : "-",
              "AI Insight & Saran": insight,
            });
          }
        }

        // Build Excel with ExcelJS for multiple sheets
        const ExcelJS = await import("exceljs");
        const workbook = new ExcelJS.Workbook();

        // Sheet 1: Attendance data
        const ws1 = workbook.addWorksheet("Rekap Kehadiran");
        ws1.addRow([`Laporan Kehadiran Seluruh Karyawan`]);
        ws1.addRow([`Periode: ${startDate} s/d ${endDate}`]);
        ws1.addRow([]);

        if (allRows.length > 0) {
          const cols = Object.keys(allRows[0]);
          const headerRow = ws1.addRow(cols);
          headerRow.font = { bold: true };
          headerRow.eachCell((cell) => {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF008751" } };
            cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
          });
          allRows.forEach((row) => ws1.addRow(cols.map((c) => row[c])));
          ws1.columns.forEach((col) => {
            let maxLen = 10;
            col.eachCell?.({ includeEmpty: false }, (cell) => {
              const len = String(cell.value ?? "").length;
              if (len > maxLen) maxLen = len;
            });
            col.width = Math.min(maxLen + 2, 40);
          });
        }

        // Sheet 2: AI Insights (if enabled)
        if (enableAI && insightRows.length > 0) {
          const ws2 = workbook.addWorksheet("AI Insight & Saran");
          ws2.addRow(["AI Insight Kehadiran Karyawan"]);
          ws2.addRow([`Periode: ${startDate} s/d ${endDate}`]);
          ws2.addRow([]);

          const cols2 = Object.keys(insightRows[0]);
          const headerRow2 = ws2.addRow(cols2);
          headerRow2.font = { bold: true };
          headerRow2.eachCell((cell) => {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF008751" } };
            cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
          });
          insightRows.forEach((row) => ws2.addRow(cols2.map((c) => row[c])));
          ws2.columns.forEach((col) => {
            let maxLen = 10;
            col.eachCell?.({ includeEmpty: false }, (cell) => {
              const len = String(cell.value ?? "").length;
              if (len > maxLen) maxLen = len;
            });
            col.width = Math.min(maxLen + 2, 60);
          });
        }

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Kehadiran_Seluruh_Karyawan_${startDate}_${endDate}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // Single employee
        const emp = targetEmployees[0];
        setProgressText(`Mengambil data ${emp.full_name}`);
        const empData = await fetchEmployeeData(emp.id, startDate, endDate, emp, holidayDates);
        const records = formatRecords(empData, startDate, endDate, holidayDates);

        if (records.length === 0) {
          toast({ title: "Tidak Ada Data", description: "Tidak ada data kehadiran untuk periode ini", variant: "destructive" });
          setLoading(false);
          return;
        }

        const excelData = records.map((r) => ({
          Tanggal: r.tanggal,
          "Check In": r.checkIn,
          "Check Out": r.checkOut,
          "Durasi (menit)": r.durasi,
          Status: r.status,
          Keterangan: r.keterangan,
        }));

        const headerRows = [
          [`Laporan Kehadiran: ${emp.full_name}`],
          [`NIK: ${emp.nik}`],
          [`Departemen: ${emp.departemen}`],
          [`Periode: ${startDate} s/d ${endDate}`],
        ];

        if (enableAI) {
          setProgressText("Generating AI insight...");
          const { insight } = await getAIInsight(emp.full_name, empData.summary, `${startDate} s/d ${endDate}`);
          headerRows.push([""]);
          headerRows.push([`AI Insight: ${insight}`]);
        }

        await exportToExcelFile(excelData, "Kehadiran", `Kehadiran_${emp.full_name}_${startDate}_${endDate}.xlsx`, headerRows);
      }

      toast({ title: "Export Berhasil", description: "File Excel berhasil diunduh" });
    } catch (error: any) {
      logger.error("Export error:", error);
      toast({ title: "Export Gagal", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
      setProgress(0);
      setProgressText("");
    }
  };

  const exportToPDF = async () => {
    if (!selectedEmployee || !startDate || !endDate) {
      toast({ title: "Data Belum Lengkap", description: "Pilih karyawan dan rentang tanggal", variant: "destructive" });
      return;
    }

    setLoading(true);
    setProgress(0);
    try {
      const holidayDates = await fetchHolidayDates();
      const targetEmployees = getTargetEmployees();
      const total = targetEmployees.length;
      const doc = new jsPDF();
      let logoBase64: string | null = null;

      try {
        logoBase64 = await loadImageAsBase64(logoImage);
      } catch (e) {
        logger.debug("Could not load logo");
      }

      for (let i = 0; i < total; i++) {
        const emp = targetEmployees[i];
        setProgressText(`Memproses ${emp.full_name} (${i + 1}/${total})`);
        setProgress(((i + 1) / (total + (enableAI ? total : 0))) * 100);

        if (i > 0) doc.addPage();

        const empData = await fetchEmployeeData(emp.id, startDate, endDate, emp, holidayDates);
        const records = formatRecords(empData, startDate, endDate, holidayDates);
        const s = empData.summary;

        // Header
        if (logoBase64) doc.addImage(logoBase64, "PNG", 14, 10, 30, 12);
        doc.setFontSize(16);
        doc.text("Laporan Kehadiran Karyawan", 50, 18);

        doc.setFontSize(10);
        doc.text(`Nama: ${emp.full_name}`, 14, 30);
        doc.text(`NIK: ${emp.nik}`, 14, 35);
        doc.text(`Departemen: ${emp.departemen}`, 14, 40);
        doc.text(`Periode: ${startDate} s/d ${endDate}`, 14, 45);

        doc.text(`Total Kehadiran: ${empData.attendance.length} hari | Cuti: ${s.cuti} hari | Dinas: ${s.dinas} hari`, 14, 55);
        doc.text(`Hadir Tepat Waktu: ${s.hadir} | Terlambat: ${s.terlambat} | Pulang Cepat: ${s.pulangCepat}`, 14, 60);
        doc.text(`Total Jam Kerja: ${Math.floor(s.totalDuration / 60)} jam ${s.totalDuration % 60} menit`, 14, 65);

        let tableStartY = 75;

        // AI Insight
        if (enableAI) {
          setProgressText(`AI insight: ${emp.full_name} (${i + 1}/${total})`);
          setProgress(((total + i + 1) / (total * 2)) * 100);
          const { insight, isGood } = await getAIInsight(emp.full_name, s, `${startDate} s/d ${endDate}`);

          // Star image at top-right corner for good attendance
          if (isGood) {
            try {
              const starBase64 = await loadImageAsBase64(goldStarImage);
              doc.addImage(starBase64, "PNG", 180, 10, 18, 18);
            } catch (e) {
              logger.error("Failed to load star image", e);
            }
          }

          const insightLines = doc.splitTextToSize(insight, 175);
          const boxHeight = Math.max(22, insightLines.length * 4 + 10);
          doc.setFillColor(240, 249, 244);
          doc.roundedRect(14, tableStartY - 2, 182, boxHeight, 2, 2, "F");

          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(0, 135, 81);
          doc.text("Saran:", 16, tableStartY + 4);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(50, 50, 50);
          doc.text(insightLines, 16, tableStartY + 10);
          doc.setTextColor(0, 0, 0);
          tableStartY += boxHeight + 6;
        }

        // Table
        const tableData = records.map((r) => [r.tanggal, r.checkIn, r.checkOut, r.durasi, r.status, r.keterangan]);

        autoTable(doc, {
          head: [["Tanggal", "Check In", "Check Out", "Durasi", "Status", "Keterangan"]],
          body: tableData,
          startY: tableStartY,
          styles: { fontSize: 8 },
          headStyles: { fillColor: [0, 135, 81] },
        });
      }

      const fileName = isAllEmployees
        ? `Kehadiran_Seluruh_Karyawan_${startDate}_${endDate}.pdf`
        : `Kehadiran_${targetEmployees[0]?.full_name}_${startDate}_${endDate}.pdf`;
      doc.save(fileName);

      toast({ title: "Export Berhasil", description: "File PDF berhasil diunduh" });
    } catch (error: any) {
      logger.error("Export error:", error);
      toast({ title: "Export Gagal", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
      setProgress(0);
      setProgressText("");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/reports")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Laporan Kehadiran per Karyawan</h1>
            <p className="text-muted-foreground mt-1">Export data kehadiran karyawan dalam format Excel atau PDF</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Konfigurasi Laporan</CardTitle>
            <CardDescription>Pilih karyawan dan rentang tanggal untuk menghasilkan laporan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="employee">Pilih Karyawan</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger id="employee">
                  <SelectValue placeholder="Pilih karyawan..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <span className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Seluruh Karyawan
                    </span>
                  </SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.nik}) - {emp.departemen}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Tanggal Mulai</Label>
                <Input id="start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">Tanggal Akhir</Label>
                <Input id="end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-primary" />
                <div>
                  <Label className="font-medium">AI Insight & Saran</Label>
                  <p className="text-sm text-muted-foreground">Generate saran otomatis berdasarkan pola kehadiran karyawan</p>
                </div>
              </div>
              <Switch checked={enableAI} onCheckedChange={setEnableAI} />
            </div>

            {loading && progress > 0 && (
              <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-sm text-muted-foreground text-center">{progressText}</p>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button onClick={exportToExcel} disabled={loading || !selectedEmployee || !startDate || !endDate} className="flex-1">
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
                Export ke Excel
              </Button>
              <Button onClick={exportToPDF} disabled={loading || !selectedEmployee || !startDate || !endDate} variant="outline" className="flex-1">
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                Export ke PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
