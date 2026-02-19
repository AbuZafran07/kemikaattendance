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
import * as XLSX from "xlsx";

interface AllowanceConfig {
  max_amount: number;
  work_hours_per_day: number;
  excluded_employee_ids: string[];
  enabled: boolean;
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
  base_allowance: number;
  late_deduction: number;
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
      options.push({
        value: format(d, "yyyy-MM"),
        label: format(d, "MMMM yyyy", { locale: idLocale }),
      });
    }
    return options;
  }, []);

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
      const monthStart = startOfMonth(new Date(year, month - 1));
      const monthEnd = endOfMonth(new Date(year, month - 1));

      // Calculate working days (excluding weekends and holidays)
      const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
      const holidayDates = new Set(holidays.map((h) => h.date));
      const workingDays = allDays.filter((d) => {
        const dateStr = format(d, "yyyy-MM-dd");
        return !isWeekend(dateStr) && !holidayDates.has(dateStr);
      });
      const totalWorkingDays = workingDays.length;

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

      // Fetch attendance for the month
      const { data: attendanceData } = await supabase
        .from("attendance")
        .select("user_id, check_in_time, status")
        .gte("check_in_time", format(monthStart, "yyyy-MM-dd'T'00:00:00"))
        .lte("check_in_time", format(monthEnd, "yyyy-MM-dd'T'23:59:59"));

      // Group attendance by user
      const attendanceByUser = new Map<string, { present: number; late: number; totalLateHours: number }>();

      for (const record of attendanceData || []) {
        const userId = record.user_id;
        if (!attendanceByUser.has(userId)) {
          attendanceByUser.set(userId, { present: 0, late: 0, totalLateHours: 0 });
        }
        const userAtt = attendanceByUser.get(userId)!;

        // Count as present (hadir or terlambat)
        if (record.status === "hadir" || record.status === "terlambat") {
          userAtt.present += 1;
        }

        // Calculate lateness
        if (record.status === "terlambat" && record.check_in_time) {
          const checkInDate = new Date(record.check_in_time);
          const checkInMinutes = checkInDate.getHours() * 60 + checkInDate.getMinutes();
          const lateMinutes = Math.max(0, checkInMinutes - deadlineTotalMinutes);
          const lateHours = Math.ceil(lateMinutes / 60); // 1 menit = 1 jam
          userAtt.late += 1;
          userAtt.totalLateHours += lateHours;
        }
      }

      // Calculate allowance per employee
      const ratePerDay = totalWorkingDays > 0 ? config.max_amount / totalWorkingDays : 0;
      const ratePerHour = config.work_hours_per_day > 0 ? ratePerDay / config.work_hours_per_day : 0;

      const employeeResults: EmployeeAllowance[] = (profiles || [])
        .filter((p) => !adminIds.has(p.id))
        .map((p) => {
          const isExcluded = config.excluded_employee_ids.includes(p.id);
          const att = attendanceByUser.get(p.id) || { present: 0, late: 0, totalLateHours: 0 };

          const baseAllowance = isExcluded ? 0 : ratePerDay * att.present;
          const lateDeduction = isExcluded ? 0 : ratePerHour * att.totalLateHours;
          const finalAllowance = Math.max(0, Math.round(baseAllowance - lateDeduction));

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
            base_allowance: Math.round(baseAllowance),
            late_deduction: Math.round(lateDeduction),
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

  const exportToExcel = () => {
    if (results.length === 0) return;

    const [year, month] = selectedMonth.split("-").map(Number);
    const monthLabel = format(new Date(year, month - 1), "MMMM yyyy", { locale: idLocale });

    const wsData = results.map((r, idx) => ({
      "No.": idx + 1,
      "NIK": r.nik,
      "Nama Karyawan": r.full_name,
      "Jabatan": r.jabatan,
      "Departemen": r.departemen,
      "Hari Kerja": r.total_working_days,
      "Hari Hadir": r.days_present,
      "Hari Terlambat": r.days_late,
      "Total Jam Terlambat": r.total_late_hours,
      "Base Tunjangan": r.excluded ? "-" : r.base_allowance,
      "Potongan Terlambat": r.excluded ? "-" : r.late_deduction,
      "Tunjangan Kehadiran": r.excluded ? "Dikecualikan" : r.final_allowance,
    }));

    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tunjangan Kehadiran");
    XLSX.writeFile(wb, `Tunjangan_Kehadiran_${selectedMonth}.xlsx`);
    toast.success("File Excel berhasil diunduh");
  };

  const exportToPDF = async () => {
    if (results.length === 0) return;

    setLoading(true);
    try {
      const [year, month] = selectedMonth.split("-").map(Number);
      const monthLabel = format(new Date(year, month - 1), "MMMM yyyy", { locale: idLocale });

      const doc = new jsPDF({ orientation: "landscape" });

      // Logo
      try {
        const logoBase64 = await loadImageAsBase64("/logo.png");
        doc.addImage(logoBase64, "PNG", 14, 10, 20, 20);
      } catch {}

      doc.setFontSize(14);
      doc.text("Laporan Tunjangan Kehadiran", 40, 18);
      doc.setFontSize(10);
      doc.text(`Periode: ${monthLabel}`, 40, 25);

      const ratePerDay = results[0]?.total_working_days > 0
        ? (config?.max_amount || 0) / results[0].total_working_days
        : 0;
      const ratePerHour = (config?.work_hours_per_day || 8) > 0
        ? ratePerDay / (config?.work_hours_per_day || 8)
        : 0;

      doc.text(`Tunjangan Maks: ${formatCurrency(config?.max_amount || 0)}  |  Hari Kerja: ${results[0]?.total_working_days}  |  Tarif/hari: ${formatCurrency(ratePerDay)}  |  Tarif potongan/jam: ${formatCurrency(ratePerHour)}`, 14, 35);

      const tableData = results.map((r, idx) => [
        idx + 1,
        r.nik,
        r.full_name,
        r.jabatan,
        r.days_present,
        r.days_late,
        r.total_late_hours,
        r.excluded ? "-" : formatCurrency(r.base_allowance),
        r.excluded ? "-" : formatCurrency(r.late_deduction),
        r.excluded ? "Dikecualikan" : formatCurrency(r.final_allowance),
      ]);

      const totalAllowance = results.reduce((s, r) => s + (r.excluded ? 0 : r.final_allowance), 0);
      tableData.push(["", "", "", "TOTAL", "", "", "", "", "", formatCurrency(totalAllowance)]);

      autoTable(doc, {
        startY: 40,
        head: [["No", "NIK", "Nama", "Jabatan", "Hadir", "Terlambat", "Jam Telat", "Base", "Potongan", "Tunjangan"]],
        body: tableData,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [41, 128, 185] },
      });

      doc.save(`Tunjangan_Kehadiran_${selectedMonth}.pdf`);
      toast.success("File PDF berhasil diunduh");
    } catch (error) {
      toast.error("Gagal export PDF");
    } finally {
      setLoading(false);
    }
  };

  const totalAllowance = results.reduce((s, r) => s + (r.excluded ? 0 : r.final_allowance), 0);
  const totalDeduction = results.reduce((s, r) => s + (r.excluded ? 0 : r.late_deduction), 0);

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
            <CardDescription>Pilih bulan untuk menghitung tunjangan kehadiran</CardDescription>
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
                <Badge variant="outline">{config.excluded_employee_ids.length} karyawan dikecualikan</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        {results.length > 0 && (
          <>
            {/* Summary */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Total Karyawan</p>
                  <p className="text-2xl font-bold">{results.filter((r) => !r.excluded).length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Total Potongan Terlambat</p>
                  <p className="text-2xl font-bold text-destructive">{formatCurrency(totalDeduction)}</p>
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
                        <TableHead className="text-right">Base</TableHead>
                        <TableHead className="text-right">Potongan</TableHead>
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
                          <TableCell className="text-right">
                            {r.excluded ? "-" : formatCurrency(r.base_allowance)}
                          </TableCell>
                          <TableCell className="text-right text-destructive">
                            {r.excluded ? "-" : r.late_deduction > 0 ? `-${formatCurrency(r.late_deduction)}` : "-"}
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
                        <TableCell colSpan={7}>TOTAL</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(results.reduce((s, r) => s + (r.excluded ? 0 : r.base_allowance), 0))}
                        </TableCell>
                        <TableCell className="text-right text-destructive">
                          -{formatCurrency(totalDeduction)}
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
