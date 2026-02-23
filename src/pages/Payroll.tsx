import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Calculator, FileText, Loader2, DollarSign, Users, TrendingUp, Lock, Download } from "lucide-react";
import {
  calculatePayroll,
  calculateOvertimePay,
  formatRupiah,
} from "@/lib/payrollCalculation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { isWeekend } from "@/hooks/usePolicySettings";
import { format, eachDayOfInterval } from "date-fns";
import logo from "@/assets/logo.png";

interface PayrollData {
  id: string;
  user_id: string;
  basic_salary: number;
  allowance: number;
  overtime_total: number;
  overtime_hours: number;
  bruto_income: number;
  bpjs_kesehatan: number;
  bpjs_ketenagakerjaan: number;
  netto_income: number;
  ptkp_status: string;
  ptkp_value: number;
  pkp: number;
  pph21_monthly: number;
  take_home_pay: number;
  employee_name?: string;
  departemen?: string;
  jabatan?: string;
  nik?: string;
}

interface PayrollPeriod {
  id: string;
  month: number;
  year: number;
  status: string;
}

const MONTHS = [
  { value: 1, label: "Januari" },
  { value: 2, label: "Februari" },
  { value: 3, label: "Maret" },
  { value: 4, label: "April" },
  { value: 5, label: "Mei" },
  { value: 6, label: "Juni" },
  { value: 7, label: "Juli" },
  { value: 8, label: "Agustus" },
  { value: 9, label: "September" },
  { value: 10, label: "Oktober" },
  { value: 11, label: "November" },
  { value: 12, label: "Desember" },
];

const currentDate = new Date();
const currentMonth = currentDate.getMonth() + 1;
const currentYear = currentDate.getFullYear();

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

const Payroll = () => {
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [period, setPeriod] = useState<PayrollPeriod | null>(null);
  const [payrollData, setPayrollData] = useState<PayrollData[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [detailItem, setDetailItem] = useState<PayrollData | null>(null);
  const { toast } = useToast();

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  useEffect(() => {
    fetchPayrollData();
  }, [selectedMonth, selectedYear]);

  const fetchPayrollData = async () => {
    setLoading(true);
    try {
      const { data: periodData } = await supabase
        .from("payroll_periods")
        .select("*")
        .eq("month", selectedMonth)
        .eq("year", selectedYear)
        .maybeSingle();

      setPeriod(periodData as PayrollPeriod | null);

      if (!periodData) {
        setPayrollData([]);
        setLoading(false);
        return;
      }

      const { data: payrolls } = await supabase
        .from("payroll")
        .select("*")
        .eq("period_id", periodData.id);

      if (!payrolls || payrolls.length === 0) {
        setPayrollData([]);
        setLoading(false);
        return;
      }

      const userIds = [...new Set(payrolls.map((p) => p.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, departemen, jabatan, nik")
        .in("id", userIds);

      const profileMap = new Map(
        (profiles || []).map((p) => [p.id, { name: p.full_name, dept: p.departemen, jabatan: p.jabatan, nik: p.nik }])
      );

      const enriched: PayrollData[] = payrolls.map((p) => ({
        ...p,
        employee_name: profileMap.get(p.user_id)?.name || "Unknown",
        departemen: profileMap.get(p.user_id)?.dept || "-",
        jabatan: profileMap.get(p.user_id)?.jabatan || "-",
        nik: profileMap.get(p.user_id)?.nik || "-",
      }));

      enriched.sort((a, b) => (a.employee_name || "").localeCompare(b.employee_name || ""));
      setPayrollData(enriched);
    } catch (error) {
      console.error("Error fetching payroll:", error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Calculate attendance allowance for all employees for the selected month.
   * Mirrors the logic in AttendanceAllowanceReport.tsx
   */
  const calculateAttendanceAllowances = async (): Promise<Map<string, number>> => {
    const allowanceMap = new Map<string, number>();

    // Fetch config
    const { data: configData } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "attendance_allowance")
      .maybeSingle();

    if (!configData?.value) return allowanceMap;
    const config = configData.value as any;
    if (!config.enabled) return allowanceMap;

    const cutoffDay = config.cutoff_day || 21;
    const maxAmount = config.max_amount || 0;
    const workHoursPerDay = config.work_hours_per_day || 8;
    const excludedIds: string[] = config.excluded_employee_ids || [];

    // Period dates
    const periodStart = new Date(selectedYear, selectedMonth - 2, cutoffDay);
    const periodEndDay = cutoffDay - 1 || 28;
    const periodEnd = new Date(selectedYear, selectedMonth - 1, periodEndDay);

    // Holidays
    const { data: holidayData } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "overtime_policy")
      .maybeSingle();
    const holidays: string[] = ((holidayData?.value as any)?.holidays || []).map((h: any) => h.date);
    const holidaySet = new Set(holidays);

    // Working days
    const allDays = eachDayOfInterval({ start: periodStart, end: periodEnd });
    const totalWorkingDays = allDays.filter((d) => {
      const ds = format(d, "yyyy-MM-dd");
      return !isWeekend(ds) && !holidaySet.has(ds);
    }).length;

    if (totalWorkingDays === 0) return allowanceMap;

    // Work hours settings for late calculation
    const { data: whData } = await supabase.rpc("get_work_hours");
    const wh = whData as Record<string, any> | null;
    const checkInEnd = wh?.check_in_end || "08:00";
    const lateTolerance = wh?.late_tolerance_minutes || 0;
    const [dlH, dlM] = checkInEnd.split(":").map(Number);
    const deadlineMinutes = dlH * 60 + dlM + lateTolerance;

    const checkOutStart = wh?.check_out_start || "17:00";
    const earlyTol = wh?.early_leave_tolerance_minutes || 0;
    const [coH, coM] = checkOutStart.split(":").map(Number);
    const coMinutes = coH * 60 + coM - earlyTol;

    // Attendance
    const { data: attendanceData } = await supabase
      .from("attendance")
      .select("user_id, check_in_time, check_out_time, status")
      .gte("check_in_time", format(periodStart, "yyyy-MM-dd'T'00:00:00"))
      .lte("check_in_time", format(periodEnd, "yyyy-MM-dd'T'23:59:59"));

    const attByUser = new Map<string, { present: number; lateHours: number; earlyHours: number }>();
    for (const r of attendanceData || []) {
      if (!attByUser.has(r.user_id)) attByUser.set(r.user_id, { present: 0, lateHours: 0, earlyHours: 0 });
      const u = attByUser.get(r.user_id)!;

      if (["hadir", "terlambat", "pulang_cepat"].includes(r.status)) u.present += 1;
      if (r.status === "terlambat" && r.check_in_time) {
        const d = new Date(r.check_in_time);
        const mins = d.getHours() * 60 + d.getMinutes();
        u.lateHours += Math.ceil(Math.max(0, mins - deadlineMinutes) / 60);
      }
      if (r.status === "pulang_cepat" && r.check_out_time) {
        const d = new Date(r.check_out_time);
        const mins = d.getHours() * 60 + d.getMinutes();
        const early = Math.max(0, coMinutes - mins);
        if (early > 0) u.earlyHours += Math.ceil(early / 60);
      }
    }

    const ratePerDay = maxAmount / totalWorkingDays;
    const ratePerHour = workHoursPerDay > 0 ? ratePerDay / workHoursPerDay : 0;

    // Build allowance map
    const { data: allProfiles } = await supabase.from("profiles").select("id").eq("status", "Active");
    for (const p of allProfiles || []) {
      if (excludedIds.includes(p.id)) { allowanceMap.set(p.id, 0); continue; }
      const att = attByUser.get(p.id) || { present: 0, lateHours: 0, earlyHours: 0 };
      const base = ratePerDay * att.present;
      const lateDed = ratePerHour * att.lateHours;
      const earlyDed = ratePerHour * att.earlyHours;
      allowanceMap.set(p.id, Math.max(0, Math.round(base - lateDed - earlyDed)));
    }

    return allowanceMap;
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      let periodId: string;
      const { data: existingPeriod } = await supabase
        .from("payroll_periods")
        .select("id, status")
        .eq("month", selectedMonth)
        .eq("year", selectedYear)
        .maybeSingle();

      if (existingPeriod?.status === "finalized") {
        toast({ title: "Payroll Terkunci", description: "Payroll periode ini sudah difinalisasi.", variant: "destructive" });
        setGenerating(false);
        return;
      }

      if (existingPeriod) {
        periodId = existingPeriod.id;
        await supabase.from("payroll").delete().eq("period_id", periodId);
      } else {
        const { data: newPeriod, error } = await supabase
          .from("payroll_periods")
          .insert({ month: selectedMonth, year: selectedYear, status: "draft" })
          .select("id")
          .single();
        if (error) throw error;
        periodId = newPeriod.id;
      }

      // Fetch employees
      const { data: employees } = await supabase
        .from("profiles")
        .select("id, full_name, basic_salary, ptkp_status, status")
        .eq("status", "Active");

      if (!employees || employees.length === 0) {
        toast({ title: "Tidak ada karyawan", description: "Tidak ditemukan karyawan aktif.", variant: "destructive" });
        setGenerating(false);
        return;
      }

      // Fetch overtime
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`;
      const endDate = new Date(selectedYear, selectedMonth, 0);
      const endDateStr = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;

      const { data: overtimeData } = await supabase
        .from("overtime_requests")
        .select("user_id, hours")
        .eq("status", "approved")
        .gte("overtime_date", startDate)
        .lte("overtime_date", endDateStr);

      const overtimeMap = new Map<string, number>();
      (overtimeData || []).forEach((ot) => {
        overtimeMap.set(ot.user_id, (overtimeMap.get(ot.user_id) || 0) + ot.hours);
      });

      // Fetch attendance allowances
      const allowanceMap = await calculateAttendanceAllowances();

      // Calculate payroll
      const payrollRecords = employees.map((emp) => {
        const basicSalary = Number(emp.basic_salary) || 0;
        const overtimeHours = overtimeMap.get(emp.id) || 0;
        const overtimeTotal = calculateOvertimePay(basicSalary, overtimeHours);
        const ptkpStatus = emp.ptkp_status || "TK/0";
        const allowance = allowanceMap.get(emp.id) || 0;

        const result = calculatePayroll({
          basicSalary,
          allowance,
          overtimeTotal,
          ptkpStatus,
          overtimeHours,
        });

        return { user_id: emp.id, period_id: periodId, ...result };
      });

      const { error: insertError } = await supabase.from("payroll").insert(payrollRecords);
      if (insertError) throw insertError;

      toast({
        title: "Payroll Berhasil Di-generate",
        description: `${payrollRecords.length} karyawan dihitung untuk ${MONTHS[selectedMonth - 1].label} ${selectedYear}. Tunjangan kehadiran sudah termasuk.`,
      });

      fetchPayrollData();
    } catch (error: any) {
      console.error("Error generating payroll:", error);
      toast({ title: "Gagal Generate Payroll", description: error.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleFinalize = async () => {
    if (!period) return;
    try {
      await supabase.from("payroll_periods").update({ status: "finalized" }).eq("id", period.id);
      toast({ title: "Payroll Difinalisasi", description: "Payroll periode ini sudah dikunci." });
      fetchPayrollData();
    } catch (error: any) {
      toast({ title: "Gagal", description: error.message, variant: "destructive" });
    }
  };

  const generateSlipPDF = async (item: PayrollData) => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 15;

    // Load logo
    try {
      const logoBase64 = await loadImageAsBase64(logo);
      doc.addImage(logoBase64, "PNG", marginX, 10, 20, 20);
    } catch {}

    // Header
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("PT. KEMIKA KARYA PRATAMA", marginX + 24, 18);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Attendance & HR Management System", marginX + 24, 24);

    // Green line
    doc.setDrawColor(0, 135, 81);
    doc.setLineWidth(1);
    doc.line(marginX, 34, pageWidth - marginX, 34);

    // Title
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("SLIP GAJI", pageWidth / 2, 42, { align: "center" });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Periode: ${MONTHS[selectedMonth - 1].label} ${selectedYear}`, pageWidth / 2, 48, { align: "center" });

    // Employee info
    let y = 56;
    doc.setFontSize(9);
    const infoLines = [
      ["Nama", item.employee_name || "-"],
      ["NIK", item.nik || "-"],
      ["Jabatan", item.jabatan || "-"],
      ["Departemen", item.departemen || "-"],
      ["Status PTKP", item.ptkp_status],
    ];
    for (const [label, val] of infoLines) {
      doc.setFont("helvetica", "normal");
      doc.text(`${label}`, marginX, y);
      doc.text(`: ${val}`, marginX + 35, y);
      y += 5;
    }

    y += 3;

    // Payroll table
    const rows = [
      ["Gaji Pokok", formatRupiah(item.basic_salary), ""],
      ["Tunjangan Kehadiran", formatRupiah(item.allowance), ""],
      [`Lembur (${item.overtime_hours} jam)`, formatRupiah(item.overtime_total), ""],
      ["", "", ""],
      ["BRUTO", "", formatRupiah(item.bruto_income)],
      ["", "", ""],
      ["Potongan BPJS Kesehatan (1%)", "", `- ${formatRupiah(item.bpjs_kesehatan)}`],
      ["Potongan BPJS TK + JP (3%)", "", `- ${formatRupiah(item.bpjs_ketenagakerjaan)}`],
      ["", "", ""],
      ["NETTO", "", formatRupiah(item.netto_income)],
      ["", "", ""],
      [`PTKP (${item.ptkp_status})`, "", formatRupiah(item.ptkp_value)],
      ["PKP (Tahunan)", "", formatRupiah(item.pkp)],
      ["PPh 21 / bulan", "", `- ${formatRupiah(item.pph21_monthly)}`],
      ["", "", ""],
      ["TAKE HOME PAY", "", formatRupiah(item.take_home_pay)],
    ];

    autoTable(doc, {
      startY: y,
      head: [["Komponen", "Pendapatan", "Jumlah"]],
      body: rows,
      margin: { left: marginX, right: marginX },
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [0, 135, 81], textColor: 255, fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { halign: "right", cellWidth: 45 },
        2: { halign: "right", cellWidth: 45 },
      },
      didParseCell: (data) => {
        const text = String(data.cell.raw);
        if (["BRUTO", "NETTO", "TAKE HOME PAY"].includes(text)) {
          data.cell.styles.fontStyle = "bold";
        }
        if (text === "TAKE HOME PAY") {
          data.cell.styles.fillColor = [240, 255, 245];
        }
      },
    });

    // Footer
    const finalY = (doc as any).lastAutoTable?.finalY || y + 80;
    doc.setFontSize(8);
    doc.setTextColor(128);
    doc.text("Dokumen ini digenerate secara otomatis oleh sistem.", marginX, finalY + 10);
    doc.text(`Dicetak pada: ${new Date().toLocaleString("id-ID")}`, marginX, finalY + 15);

    doc.save(`Slip_Gaji_${item.employee_name?.replace(/\s+/g, "_")}_${MONTHS[selectedMonth - 1].label}_${selectedYear}.pdf`);
  };

  const totalBruto = payrollData.reduce((s, p) => s + p.bruto_income, 0);
  const totalTHP = payrollData.reduce((s, p) => s + p.take_home_pay, 0);
  const totalPPh = payrollData.reduce((s, p) => s + p.pph21_monthly, 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <DollarSign className="h-7 w-7 text-primary" />
              Payroll
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Kelola penggajian karyawan dengan perhitungan PPh 21 & tunjangan kehadiran otomatis
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => (<SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>))}
              </SelectContent>
            </Select>

            <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map((y) => (<SelectItem key={y} value={String(y)}>{y}</SelectItem>))}
              </SelectContent>
            </Select>

            <Button onClick={handleGenerate} disabled={generating || period?.status === "finalized"} className="gap-2">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
              Generate Payroll
            </Button>

            {period?.status === "draft" && payrollData.length > 0 && (
              <Button variant="outline" onClick={handleFinalize} className="gap-2">
                <Lock className="h-4 w-4" />
                Finalisasi
              </Button>
            )}
          </div>
        </div>

        {/* Status Badge */}
        {period && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status Periode:</span>
            <Badge variant={period.status === "finalized" ? "default" : "secondary"}>
              {period.status === "finalized" ? "🔒 Finalized" : "📝 Draft"}
            </Badge>
          </div>
        )}

        {/* Summary Cards */}
        {payrollData.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Users className="h-8 w-8 text-primary/60" /><div><p className="text-2xl font-bold">{payrollData.length}</p><p className="text-xs text-muted-foreground">Total Karyawan</p></div></div></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><TrendingUp className="h-8 w-8 text-primary/40" /><div><p className="text-lg font-bold">{formatRupiah(totalBruto)}</p><p className="text-xs text-muted-foreground">Total Bruto</p></div></div></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><FileText className="h-8 w-8 text-destructive/40" /><div><p className="text-lg font-bold">{formatRupiah(totalPPh)}</p><p className="text-xs text-muted-foreground">Total PPh 21</p></div></div></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><DollarSign className="h-8 w-8 text-primary/40" /><div><p className="text-lg font-bold">{formatRupiah(totalTHP)}</p><p className="text-xs text-muted-foreground">Total THP</p></div></div></CardContent></Card>
          </div>
        )}

        {/* Payroll Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Data Payroll — {MONTHS[selectedMonth - 1].label} {selectedYear}</CardTitle>
            <CardDescription>Daftar penggajian karyawan beserta tunjangan, potongan, dan pajak</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : payrollData.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Calculator className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Belum ada data payroll</p>
                <p className="text-sm mt-1">Klik "Generate Payroll" untuk menghitung gaji periode ini</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">No</TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead>Dept</TableHead>
                      <TableHead className="text-right">Gaji Pokok</TableHead>
                      <TableHead className="text-right">Tunjangan</TableHead>
                      <TableHead className="text-right">Lembur</TableHead>
                      <TableHead className="text-right">Bruto</TableHead>
                      <TableHead className="text-right">BPJS</TableHead>
                      <TableHead className="text-right">PPh 21</TableHead>
                      <TableHead className="text-right">THP</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payrollData.map((item, idx) => (
                      <TableRow key={item.id} className="cursor-pointer hover:bg-accent/50" onClick={() => setDetailItem(item)}>
                        <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-medium">{item.employee_name}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{item.departemen}</Badge></TableCell>
                        <TableCell className="text-right text-sm">{formatRupiah(item.basic_salary)}</TableCell>
                        <TableCell className="text-right text-sm">
                          {item.allowance > 0 ? formatRupiah(item.allowance) : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {item.overtime_hours > 0 ? <span title={`${item.overtime_hours} jam`}>{formatRupiah(item.overtime_total)}</span> : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">{formatRupiah(item.bruto_income)}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">{formatRupiah(item.bpjs_kesehatan + item.bpjs_ketenagakerjaan)}</TableCell>
                        <TableCell className="text-right text-sm text-destructive">{formatRupiah(item.pph21_monthly)}</TableCell>
                        <TableCell className="text-right text-sm font-bold text-primary">{formatRupiah(item.take_home_pay)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={(e) => { e.stopPropagation(); setDetailItem(item); }}>
                              Detail
                            </Button>
                            <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={(e) => { e.stopPropagation(); generateSlipPDF(item); }} title="Download Slip PDF">
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell colSpan={3}>Total</TableCell>
                      <TableCell className="text-right">{formatRupiah(payrollData.reduce((s, p) => s + p.basic_salary, 0))}</TableCell>
                      <TableCell className="text-right">{formatRupiah(payrollData.reduce((s, p) => s + p.allowance, 0))}</TableCell>
                      <TableCell className="text-right">{formatRupiah(payrollData.reduce((s, p) => s + p.overtime_total, 0))}</TableCell>
                      <TableCell className="text-right">{formatRupiah(totalBruto)}</TableCell>
                      <TableCell className="text-right">{formatRupiah(payrollData.reduce((s, p) => s + p.bpjs_kesehatan + p.bpjs_ketenagakerjaan, 0))}</TableCell>
                      <TableCell className="text-right text-destructive">{formatRupiah(totalPPh)}</TableCell>
                      <TableCell className="text-right text-primary">{formatRupiah(totalTHP)}</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detail Dialog */}
        <Dialog open={!!detailItem} onOpenChange={(open) => !open && setDetailItem(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Detail Slip Gaji</DialogTitle>
              <DialogDescription>{detailItem?.employee_name} — {MONTHS[selectedMonth - 1].label} {selectedYear}</DialogDescription>
            </DialogHeader>
            {detailItem && (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2 border-b border-border pb-3">
                  <span className="text-muted-foreground">Gaji Pokok</span>
                  <span className="text-right font-medium">{formatRupiah(detailItem.basic_salary)}</span>
                  <span className="text-muted-foreground">Tunjangan Kehadiran</span>
                  <span className="text-right">{formatRupiah(detailItem.allowance)}</span>
                  <span className="text-muted-foreground">Lembur ({detailItem.overtime_hours} jam)</span>
                  <span className="text-right">{formatRupiah(detailItem.overtime_total)}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 border-b border-border pb-3">
                  <span className="font-semibold">Bruto</span>
                  <span className="text-right font-semibold">{formatRupiah(detailItem.bruto_income)}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 border-b border-border pb-3">
                  <span className="text-muted-foreground">BPJS Kesehatan (1%)</span>
                  <span className="text-right text-destructive">-{formatRupiah(detailItem.bpjs_kesehatan)}</span>
                  <span className="text-muted-foreground">BPJS TK + JP (3%)</span>
                  <span className="text-right text-destructive">-{formatRupiah(detailItem.bpjs_ketenagakerjaan)}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 border-b border-border pb-3">
                  <span className="font-semibold">Netto</span>
                  <span className="text-right font-semibold">{formatRupiah(detailItem.netto_income)}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 border-b border-border pb-3">
                  <span className="text-muted-foreground">PTKP ({detailItem.ptkp_status})</span>
                  <span className="text-right">{formatRupiah(detailItem.ptkp_value)}</span>
                  <span className="text-muted-foreground">PKP (Tahunan)</span>
                  <span className="text-right">{formatRupiah(detailItem.pkp)}</span>
                  <span className="text-muted-foreground">PPh 21 / bulan</span>
                  <span className="text-right text-destructive font-medium">-{formatRupiah(detailItem.pph21_monthly)}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <span className="text-base font-bold">Take Home Pay</span>
                  <span className="text-right text-base font-bold text-primary">{formatRupiah(detailItem.take_home_pay)}</span>
                </div>

                <div className="pt-3 border-t border-border">
                  <Button onClick={() => generateSlipPDF(detailItem)} className="w-full gap-2">
                    <Download className="h-4 w-4" />
                    Download Slip Gaji PDF
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Payroll;
