import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Loader2, Download, FileSpreadsheet, Search, ArrowLeft, Calculator, TrendingUp } from "lucide-react";
import { formatRupiah, calculatePPh21Annual } from "@/lib/payrollCalculation";
import { exportToExcelFile } from "@/lib/excelExport";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logo from "@/assets/logo.png";
import { useNavigate } from "react-router-dom";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

interface MonthlyPPh21 {
  month: number;
  bruto: number;
  pph21: number;
  ter_rate: number | null;
  mode: string;
}

interface EmployeePPh21Data {
  user_id: string;
  full_name: string;
  nik: string;
  npwp: string;
  jabatan: string;
  departemen: string;
  ptkp_status: string;
  ptkp_value: number;
  monthly: MonthlyPPh21[];
  total_bruto: number;
  total_pph21: number;
  total_bpjs_kt: number;
  biaya_jabatan: number;
  netto_annual: number;
  pkp: number;
  pph21_terutang: number;
  selisih: number;
}

const currentYear = new Date().getFullYear();

const loadImageAsBase64 = (src: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width; canvas.height = img.height;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = src;
  });

const PPh21Report = () => {
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [data, setData] = useState<EmployeePPh21Data[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 3 + i);

  useEffect(() => { fetchData(); }, [selectedYear]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: periods } = await supabase
        .from("payroll_periods").select("id, month")
        .eq("year", selectedYear).eq("status", "finalized");

      if (!periods || periods.length === 0) { setData([]); return; }

      const periodMap = new Map(periods.map(p => [p.id, p.month]));
      const periodIds = periods.map(p => p.id);

      const { data: payrolls } = await supabase
        .from("payroll")
        .select("user_id, period_id, bruto_income, bpjs_ketenagakerjaan, pph21_monthly, ptkp_status, ptkp_value, pph21_mode, pph21_ter_rate")
        .in("period_id", periodIds);

      if (!payrolls || payrolls.length === 0) { setData([]); return; }

      // Group by user
      const userMap = new Map<string, { monthlyData: Map<number, MonthlyPPh21>; totalBruto: number; totalPph21: number; totalBpjsKt: number; ptkpStatus: string; ptkpValue: number }>();

      for (const p of payrolls) {
        const month = periodMap.get(p.period_id)!;
        if (!userMap.has(p.user_id)) {
          userMap.set(p.user_id, { monthlyData: new Map(), totalBruto: 0, totalPph21: 0, totalBpjsKt: 0, ptkpStatus: p.ptkp_status, ptkpValue: p.ptkp_value });
        }
        const u = userMap.get(p.user_id)!;
        u.monthlyData.set(month, {
          month,
          bruto: p.bruto_income,
          pph21: p.pph21_monthly,
          ter_rate: p.pph21_ter_rate,
          mode: p.pph21_mode,
        });
        u.totalBruto += p.bruto_income;
        u.totalPph21 += p.pph21_monthly;
        u.totalBpjsKt += p.bpjs_ketenagakerjaan;
      }

      const userIds = [...userMap.keys()];
      const { data: profiles } = await supabase
        .from("profiles").select("id, full_name, nik, jabatan, departemen, npwp")
        .in("id", userIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      const result: EmployeePPh21Data[] = userIds.map(uid => {
        const u = userMap.get(uid)!;
        const prof = profileMap.get(uid);
        const biayaJabatan = Math.min(u.totalBruto * 0.05, 6000000);
        const nettoAnnual = u.totalBruto - biayaJabatan - u.totalBpjsKt;
        const pkp = Math.max(0, nettoAnnual - u.ptkpValue);
        const pph21Terutang = calculatePPh21Annual(pkp);

        const monthly: MonthlyPPh21[] = [];
        for (let m = 1; m <= 12; m++) {
          monthly.push(u.monthlyData.get(m) || { month: m, bruto: 0, pph21: 0, ter_rate: null, mode: "-" });
        }

        return {
          user_id: uid,
          full_name: prof?.full_name || "Unknown",
          nik: prof?.nik || "-",
          npwp: prof?.npwp || "-",
          jabatan: prof?.jabatan || "-",
          departemen: prof?.departemen || "-",
          ptkp_status: u.ptkpStatus,
          ptkp_value: u.ptkpValue,
          monthly,
          total_bruto: u.totalBruto,
          total_pph21: u.totalPph21,
          total_bpjs_kt: u.totalBpjsKt,
          biaya_jabatan: biayaJabatan,
          netto_annual: nettoAnnual,
          pkp,
          pph21_terutang: pph21Terutang,
          selisih: pph21Terutang - u.totalPph21,
        };
      }).sort((a, b) => a.full_name.localeCompare(b.full_name));

      setData(result);
    } catch (error: any) {
      toast({ title: "Gagal memuat data", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filtered = data.filter(d =>
    d.full_name.toLowerCase().includes(search.toLowerCase()) ||
    d.nik.toLowerCase().includes(search.toLowerCase()) ||
    d.npwp.toLowerCase().includes(search.toLowerCase())
  );

  const totalBruto = data.reduce((s, d) => s + d.total_bruto, 0);
  const totalPph21 = data.reduce((s, d) => s + d.total_pph21, 0);
  const totalTerutang = data.reduce((s, d) => s + d.pph21_terutang, 0);
  const totalSelisih = totalTerutang - totalPph21;

  // Monthly aggregates for summary chart
  const monthlySummary = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    return {
      month,
      label: MONTHS[i],
      totalBruto: data.reduce((s, d) => s + (d.monthly[i]?.bruto || 0), 0),
      totalPph21: data.reduce((s, d) => s + (d.monthly[i]?.pph21 || 0), 0),
    };
  });

  const exportExcel = async () => {
    // Summary sheet
    const summaryRows = data.map((d, idx) => ({
      "No": idx + 1,
      "Nama": d.full_name,
      "NIK": d.nik,
      "NPWP": d.npwp,
      "Jabatan": d.jabatan,
      "Departemen": d.departemen,
      "PTKP": d.ptkp_status,
      "Bruto Tahunan": d.total_bruto,
      "Biaya Jabatan": d.biaya_jabatan,
      "JHT+JP Karyawan": d.total_bpjs_kt,
      "Netto Tahunan": d.netto_annual,
      "PTKP Value": d.ptkp_value,
      "PKP": d.pkp,
      "PPh 21 Terutang": d.pph21_terutang,
      "PPh 21 Dipotong": d.total_pph21,
      "Selisih": d.selisih,
    }));

    // Monthly detail sheet
    const monthlyRows: any[] = [];
    for (const d of data) {
      for (const m of d.monthly) {
        if (m.bruto > 0) {
          monthlyRows.push({
            "Nama": d.full_name,
            "NIK": d.nik,
            "NPWP": d.npwp,
            "Bulan": MONTH_NAMES[m.month - 1],
            "Bruto": m.bruto,
            "PPh 21": m.pph21,
            "Tarif TER": m.ter_rate ? `${(m.ter_rate * 100).toFixed(2)}%` : "-",
            "Mode": m.mode,
          });
        }
      }
    }

    // Monthly aggregate sheet
    const aggRows = monthlySummary.map(m => ({
      "Bulan": MONTH_NAMES[m.month - 1],
      "Total Bruto": m.totalBruto,
      "Total PPh 21": m.totalPph21,
    }));

    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();

    // Sheet 1 - Rekap Tahunan
    const ws1 = workbook.addWorksheet("Rekap PPh 21 Tahunan");
    const cols1 = Object.keys(summaryRows[0] || {});
    ws1.addRow(cols1);
    ws1.getRow(1).font = { bold: true };
    ws1.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF008751" } };
    ws1.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    for (const row of summaryRows) ws1.addRow(Object.values(row));
    cols1.forEach((_, i) => { ws1.getColumn(i + 1).width = 18; });

    // Sheet 2 - Detail Bulanan
    const ws2 = workbook.addWorksheet("Detail Bulanan");
    const cols2 = Object.keys(monthlyRows[0] || {});
    ws2.addRow(cols2);
    ws2.getRow(1).font = { bold: true };
    ws2.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF008751" } };
    ws2.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    for (const row of monthlyRows) ws2.addRow(Object.values(row));
    cols2.forEach((_, i) => { ws2.getColumn(i + 1).width = 18; });

    // Sheet 3 - Ringkasan Bulanan
    const ws3 = workbook.addWorksheet("Ringkasan Bulanan");
    const cols3 = Object.keys(aggRows[0] || {});
    ws3.addRow(cols3);
    ws3.getRow(1).font = { bold: true };
    ws3.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF008751" } };
    ws3.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    for (const row of aggRows) ws3.addRow(Object.values(row));
    cols3.forEach((_, i) => { ws3.getColumn(i + 1).width = 20; });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `Laporan_PPh21_${selectedYear}.xlsx`;
    a.click(); URL.revokeObjectURL(url);
    toast({ title: "Excel berhasil di-download" });
  };

  const exportPDF = async () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const mx = 10;

    try {
      const logoBase64 = await loadImageAsBase64(logo);
      doc.addImage(logoBase64, "PNG", mx, 8, 16, 16);
    } catch {}

    doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text("LAPORAN PPh 21", mx + 20, 14);
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(`Tahun Pajak: ${selectedYear} | PT. Kemika Karya Pratama`, mx + 20, 20);
    doc.setDrawColor(0, 135, 81); doc.setLineWidth(0.8);
    doc.line(mx, 26, pw - mx, 26);

    // Summary cards
    let y = 32;
    doc.setFontSize(8); doc.setFont("helvetica", "bold");
    const cardData = [
      { label: "Total Karyawan", value: String(data.length) },
      { label: "Total Bruto", value: formatRupiah(totalBruto) },
      { label: "PPh 21 Dipotong", value: formatRupiah(totalPph21) },
      { label: "PPh 21 Terutang", value: formatRupiah(totalTerutang) },
      { label: "Selisih", value: formatRupiah(totalSelisih) },
    ];
    const cardW = (pw - 2 * mx - 4 * 4) / 5;
    cardData.forEach((c, i) => {
      const cx = mx + i * (cardW + 4);
      doc.setFillColor(245, 245, 245);
      doc.roundedRect(cx, y, cardW, 14, 2, 2, "F");
      doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(100);
      doc.text(c.label, cx + 3, y + 5);
      doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(0);
      doc.text(c.value, cx + 3, y + 11);
    });
    y += 20;

    // Table
    autoTable(doc, {
      startY: y,
      head: [["No", "Nama", "NIK", "NPWP", "PTKP", "Bruto Tahunan", "Biaya Jabatan", "JHT+JP", "Netto", "PTKP Value", "PKP", "PPh 21 Terutang", "PPh 21 Dipotong", "Selisih"]],
      body: data.map((d, i) => [
        i + 1, d.full_name, d.nik, d.npwp, d.ptkp_status,
        formatRupiah(d.total_bruto), formatRupiah(d.biaya_jabatan), formatRupiah(d.total_bpjs_kt),
        formatRupiah(d.netto_annual), formatRupiah(d.ptkp_value), formatRupiah(d.pkp),
        formatRupiah(d.pph21_terutang), formatRupiah(d.total_pph21), formatRupiah(d.selisih),
      ]),
      margin: { left: mx, right: mx },
      styles: { fontSize: 6.5, cellPadding: 2 },
      headStyles: { fillColor: [0, 135, 81], textColor: 255, fontStyle: "bold", fontSize: 6.5 },
      columnStyles: {
        0: { cellWidth: 8, halign: "center" },
        5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" },
        8: { halign: "right" }, 9: { halign: "right" }, 10: { halign: "right" },
        11: { halign: "right" }, 12: { halign: "right" }, 13: { halign: "right" },
      },
      foot: [[
        "", "TOTAL", "", "", "",
        formatRupiah(totalBruto), "", "", "", "", "",
        formatRupiah(totalTerutang), formatRupiah(totalPph21), formatRupiah(totalSelisih),
      ]],
      footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: "bold", fontSize: 6.5 },
    });

    // Footer
    const finalY2 = (doc as any).lastAutoTable?.finalY || y + 60;
    doc.setFontSize(7); doc.setTextColor(128); doc.setFont("helvetica", "normal");
    doc.text(`Dicetak pada: ${new Date().toLocaleString("id-ID")}`, mx, Math.min(finalY2 + 10, ph - 8));
    doc.text("Dokumen ini digenerate otomatis oleh sistem.", pw - mx, Math.min(finalY2 + 10, ph - 8), { align: "right" });

    doc.save(`Laporan_PPh21_${selectedYear}.pdf`);
    toast({ title: "PDF berhasil di-download" });
  };

  const exportMonthlyPDF = async (month: number) => {
    const monthName = MONTH_NAMES[month - 1];
    const monthData = data.filter(d => d.monthly[month - 1]?.bruto > 0).map(d => ({
      ...d,
      m: d.monthly[month - 1],
    }));

    if (monthData.length === 0) {
      toast({ title: "Tidak ada data", description: `Belum ada data PPh 21 untuk ${monthName} ${selectedYear}`, variant: "destructive" });
      return;
    }

    const monthTotalBruto = monthData.reduce((s, d) => s + d.m.bruto, 0);
    const monthTotalPph21 = monthData.reduce((s, d) => s + d.m.pph21, 0);

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const mx = 10;

    try {
      const logoBase64 = await loadImageAsBase64(logo);
      doc.addImage(logoBase64, "PNG", mx, 8, 16, 16);
    } catch {}

    doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text(`LAPORAN PPh 21 — ${monthName.toUpperCase()} ${selectedYear}`, mx + 20, 14);
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(`Masa Pajak: ${monthName} ${selectedYear} | PT. Kemika Karya Pratama`, mx + 20, 20);
    doc.setDrawColor(0, 135, 81); doc.setLineWidth(0.8);
    doc.line(mx, 26, pw - mx, 26);

    let y = 32;
    const cardItems = [
      { label: "Total Karyawan", value: String(monthData.length) },
      { label: "Total Bruto", value: formatRupiah(monthTotalBruto) },
      { label: "Total PPh 21", value: formatRupiah(monthTotalPph21) },
    ];
    const cw = (pw - 2 * mx - 2 * 4) / 3;
    cardItems.forEach((c, i) => {
      const cx = mx + i * (cw + 4);
      doc.setFillColor(245, 245, 245);
      doc.roundedRect(cx, y, cw, 14, 2, 2, "F");
      doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(100);
      doc.text(c.label, cx + 3, y + 5);
      doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(0);
      doc.text(c.value, cx + 3, y + 11);
    });
    y += 20;

    autoTable(doc, {
      startY: y,
      head: [["No", "Nama", "NIK", "NPWP", "Jabatan", "Departemen", "Bruto", "PPh 21", "Tarif TER", "Mode"]],
      body: monthData.map((d, i) => [
        i + 1, d.full_name, d.nik, d.npwp, d.jabatan, d.departemen,
        formatRupiah(d.m.bruto), formatRupiah(d.m.pph21),
        d.m.ter_rate ? `${(d.m.ter_rate * 100).toFixed(2)}%` : "-",
        d.m.mode,
      ]),
      margin: { left: mx, right: mx },
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [0, 135, 81], textColor: 255, fontStyle: "bold", fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 8, halign: "center" },
        6: { halign: "right" }, 7: { halign: "right" }, 8: { halign: "right" },
      },
      foot: [["", "TOTAL", "", "", "", "", formatRupiah(monthTotalBruto), formatRupiah(monthTotalPph21), "", ""]],
      footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: "bold", fontSize: 7 },
    });

    const fy = (doc as any).lastAutoTable?.finalY || y + 60;
    doc.setFontSize(7); doc.setTextColor(128); doc.setFont("helvetica", "normal");
    doc.text(`Dicetak pada: ${new Date().toLocaleString("id-ID")}`, mx, Math.min(fy + 10, ph - 8));
    doc.text("Dokumen ini digenerate otomatis oleh sistem.", pw - mx, Math.min(fy + 10, ph - 8), { align: "right" });

    doc.save(`Laporan_PPh21_${monthName}_${selectedYear}.pdf`);
    toast({ title: `PDF ${monthName} berhasil di-download` });
  };

  const exportMonthlyExcel = async (month: number) => {
    const monthName = MONTH_NAMES[month - 1];
    const monthData = data.filter(d => d.monthly[month - 1]?.bruto > 0);

    if (monthData.length === 0) {
      toast({ title: "Tidak ada data", description: `Belum ada data PPh 21 untuk ${monthName} ${selectedYear}`, variant: "destructive" });
      return;
    }

    const rows = monthData.map((d, idx) => ({
      "No": idx + 1,
      "Nama": d.full_name,
      "NIK": d.nik,
      "NPWP": d.npwp,
      "Jabatan": d.jabatan,
      "Departemen": d.departemen,
      "PTKP": d.ptkp_status,
      "Bruto": d.monthly[month - 1].bruto,
      "PPh 21": d.monthly[month - 1].pph21,
      "Tarif TER": d.monthly[month - 1].ter_rate ? `${(d.monthly[month - 1].ter_rate! * 100).toFixed(2)}%` : "-",
      "Mode": d.monthly[month - 1].mode,
    }));

    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet(`PPh21 ${monthName} ${selectedYear}`);
    const cols = Object.keys(rows[0]);
    ws.addRow(cols);
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF008751" } };
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    for (const row of rows) ws.addRow(Object.values(row));
    cols.forEach((_, i) => { ws.getColumn(i + 1).width = 18; });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `Laporan_PPh21_${monthName}_${selectedYear}.xlsx`;
    a.click(); URL.revokeObjectURL(url);
    toast({ title: `Excel ${monthName} berhasil di-download` });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <Button variant="ghost" size="sm" className="mb-2 -ml-2 gap-1" onClick={() => navigate("/dashboard/reports")}>
              <ArrowLeft className="h-4 w-4" /> Kembali ke Laporan
            </Button>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calculator className="h-7 w-7 text-primary" /> Laporan PPh 21
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Rekap pajak penghasilan pasal 21 per karyawan untuk keperluan lapor pajak
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
              <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
            {data.length > 0 && (
              <>
                <Button onClick={exportExcel} variant="outline" className="gap-2">
                  <FileSpreadsheet className="h-4 w-4" /> Export Excel
                </Button>
                <Button onClick={exportPDF} variant="outline" className="gap-2">
                  <FileText className="h-4 w-4" /> Export PDF
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        {data.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-2xl font-bold">{data.length}</p>
                <p className="text-xs text-muted-foreground">Karyawan</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm font-bold">{formatRupiah(totalBruto)}</p>
                <p className="text-xs text-muted-foreground">Total Bruto</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm font-bold text-destructive">{formatRupiah(totalPph21)}</p>
                <p className="text-xs text-muted-foreground">PPh 21 Dipotong</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm font-bold">{formatRupiah(totalTerutang)}</p>
                <p className="text-xs text-muted-foreground">PPh 21 Terutang</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className={`text-sm font-bold ${totalSelisih > 0 ? "text-destructive" : totalSelisih < 0 ? "text-green-600" : ""}`}>
                  {formatRupiah(totalSelisih)}
                </p>
                <p className="text-xs text-muted-foreground">Selisih (Kurang/Lebih)</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Monthly Summary */}
        {data.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" /> Ringkasan Bulanan
              </CardTitle>
              <CardDescription>PPh 21 yang dipotong per bulan — {selectedYear}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {MONTHS.map(m => <TableHead key={m} className="text-center text-xs">{m}</TableHead>)}
                      <TableHead className="text-right font-bold text-xs">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      {monthlySummary.map(m => (
                        <TableCell key={m.month} className="text-center text-xs">
                          {m.totalPph21 > 0 ? formatRupiah(m.totalPph21) : "-"}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-bold text-xs text-destructive">
                        {formatRupiah(totalPph21)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Monthly Export */}
        {data.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Download className="h-5 w-5" /> Export Laporan Per Bulan
              </CardTitle>
              <CardDescription>Pilih bulan untuk export laporan PPh 21 bulanan (untuk lapor masa pajak)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <Select value={selectedMonth !== null ? String(selectedMonth) : ""} onValueChange={(v) => setSelectedMonth(Number(v))}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Pilih Bulan" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES.map((name, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => selectedMonth && exportMonthlyExcel(selectedMonth)}
                  disabled={selectedMonth === null}
                  variant="outline"
                  className="gap-2"
                >
                  <FileSpreadsheet className="h-4 w-4" /> Excel Bulanan
                </Button>
                <Button
                  onClick={() => selectedMonth && exportMonthlyPDF(selectedMonth)}
                  disabled={selectedMonth === null}
                  variant="outline"
                  className="gap-2"
                >
                  <FileText className="h-4 w-4" /> PDF Bulanan
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Detail Per Karyawan</CardTitle>
                <CardDescription>Klik baris untuk lihat rincian bulanan</CardDescription>
              </div>
              {data.length > 0 && (
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Cari nama/NIK/NPWP..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : data.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Calculator className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Belum ada data payroll yang difinalisasi</p>
                <p className="text-sm mt-1">Finalisasi payroll terlebih dahulu untuk melihat laporan PPh 21</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">No</TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead>NIK</TableHead>
                      <TableHead>NPWP</TableHead>
                      <TableHead>PTKP</TableHead>
                      <TableHead className="text-right">Bruto Tahunan</TableHead>
                      <TableHead className="text-right">PPh 21 Dipotong</TableHead>
                      <TableHead className="text-right">PPh 21 Terutang</TableHead>
                      <TableHead className="text-right">Selisih</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((emp, idx) => (
                      <>
                        <TableRow
                          key={emp.user_id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setExpandedUser(expandedUser === emp.user_id ? null : emp.user_id)}
                        >
                          <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="font-medium">{emp.full_name}</TableCell>
                          <TableCell className="text-sm">{emp.nik}</TableCell>
                          <TableCell className="text-sm">{emp.npwp}</TableCell>
                          <TableCell><Badge variant="outline">{emp.ptkp_status}</Badge></TableCell>
                          <TableCell className="text-right text-sm">{formatRupiah(emp.total_bruto)}</TableCell>
                          <TableCell className="text-right text-sm text-destructive">{formatRupiah(emp.total_pph21)}</TableCell>
                          <TableCell className="text-right text-sm">{formatRupiah(emp.pph21_terutang)}</TableCell>
                          <TableCell className={`text-right text-sm font-medium ${emp.selisih > 0 ? "text-destructive" : emp.selisih < 0 ? "text-green-600" : ""}`}>
                            {formatRupiah(emp.selisih)}
                          </TableCell>
                        </TableRow>
                        {expandedUser === emp.user_id && (
                          <TableRow key={`${emp.user_id}-detail`}>
                            <TableCell colSpan={9} className="bg-muted/30 p-4">
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                  <div><span className="text-muted-foreground">Biaya Jabatan:</span> <span className="font-medium">{formatRupiah(emp.biaya_jabatan)}</span></div>
                                  <div><span className="text-muted-foreground">JHT+JP:</span> <span className="font-medium">{formatRupiah(emp.total_bpjs_kt)}</span></div>
                                  <div><span className="text-muted-foreground">Netto:</span> <span className="font-medium">{formatRupiah(emp.netto_annual)}</span></div>
                                  <div><span className="text-muted-foreground">PKP:</span> <span className="font-medium">{formatRupiah(emp.pkp)}</span></div>
                                </div>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="text-xs">Bulan</TableHead>
                                      <TableHead className="text-right text-xs">Bruto</TableHead>
                                      <TableHead className="text-right text-xs">PPh 21</TableHead>
                                      <TableHead className="text-right text-xs">Tarif TER</TableHead>
                                      <TableHead className="text-xs">Mode</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {emp.monthly.map(m => (
                                      <TableRow key={m.month} className={m.bruto === 0 ? "opacity-40" : ""}>
                                        <TableCell className="text-xs">{MONTH_NAMES[m.month - 1]}</TableCell>
                                        <TableCell className="text-right text-xs">{m.bruto > 0 ? formatRupiah(m.bruto) : "-"}</TableCell>
                                        <TableCell className="text-right text-xs">{m.pph21 > 0 ? formatRupiah(m.pph21) : "-"}</TableCell>
                                        <TableCell className="text-right text-xs">{m.ter_rate ? `${(m.ter_rate * 100).toFixed(2)}%` : "-"}</TableCell>
                                        <TableCell className="text-xs">{m.mode !== "-" ? <Badge variant="secondary" className="text-[10px]">{m.mode}</Badge> : "-"}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default PPh21Report;
