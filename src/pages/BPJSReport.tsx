import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Download, FileSpreadsheet, Search, ArrowLeft, Shield } from "lucide-react";
import { formatRupiah } from "@/lib/payrollCalculation";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logo from "@/assets/logo.png";
import { useNavigate } from "react-router-dom";

const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

interface Row {
  user_id: string;
  full_name: string;
  nik: string;
  jabatan: string;
  departemen: string;
  // employee
  bpjs_kesehatan: number;       // employee 1%
  bpjs_ketenagakerjaan: number; // employee JHT 2% + JP 1%
  // employer
  bpjs_kes_employer: number;
  bpjs_jht_employer: number;
  bpjs_jp_employer: number;
  bpjs_jkk_employer: number;
  bpjs_jkm_employer: number;
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

const BPJSReport = () => {
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number | "all">(new Date().getMonth() + 1);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 3 + i);

  useEffect(() => { fetchData(); }, [selectedYear, selectedMonth]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let q = supabase.from("payroll_periods").select("id, month").eq("year", selectedYear).eq("status", "finalized");
      if (selectedMonth !== "all") q = q.eq("month", selectedMonth as number);
      const { data: periods } = await q;

      if (!periods || periods.length === 0) { setRows([]); return; }
      const periodIds = periods.map(p => p.id);

      const { data: payrolls } = await supabase
        .from("payroll")
        .select("user_id, bpjs_kesehatan, bpjs_ketenagakerjaan, bpjs_kes_employer, bpjs_jht_employer, bpjs_jp_employer, bpjs_jkk_employer, bpjs_jkm_employer")
        .in("period_id", periodIds);

      if (!payrolls || payrolls.length === 0) { setRows([]); return; }

      // Aggregate per user
      const m = new Map<string, Row>();
      for (const p of payrolls) {
        const cur = m.get(p.user_id) || {
          user_id: p.user_id, full_name: "", nik: "", jabatan: "", departemen: "",
          bpjs_kesehatan: 0, bpjs_ketenagakerjaan: 0,
          bpjs_kes_employer: 0, bpjs_jht_employer: 0, bpjs_jp_employer: 0,
          bpjs_jkk_employer: 0, bpjs_jkm_employer: 0,
        };
        cur.bpjs_kesehatan += Number(p.bpjs_kesehatan) || 0;
        cur.bpjs_ketenagakerjaan += Number(p.bpjs_ketenagakerjaan) || 0;
        cur.bpjs_kes_employer += Number(p.bpjs_kes_employer) || 0;
        cur.bpjs_jht_employer += Number(p.bpjs_jht_employer) || 0;
        cur.bpjs_jp_employer += Number(p.bpjs_jp_employer) || 0;
        cur.bpjs_jkk_employer += Number(p.bpjs_jkk_employer) || 0;
        cur.bpjs_jkm_employer += Number(p.bpjs_jkm_employer) || 0;
        m.set(p.user_id, cur);
      }

      const userIds = [...m.keys()];
      const { data: profiles } = await supabase
        .from("profiles").select("id, full_name, nik, jabatan, departemen")
        .in("id", userIds);
      const pmap = new Map((profiles || []).map(p => [p.id, p]));

      const result = userIds.map(uid => {
        const r = m.get(uid)!;
        const pr = pmap.get(uid);
        return { ...r,
          full_name: pr?.full_name || "Unknown",
          nik: pr?.nik || "-",
          jabatan: pr?.jabatan || "-",
          departemen: pr?.departemen || "-",
        };
      })
      // Only show rows that actually have BPJS values
      .filter(r => r.bpjs_kesehatan + r.bpjs_ketenagakerjaan + r.bpjs_kes_employer + r.bpjs_jht_employer + r.bpjs_jp_employer + r.bpjs_jkk_employer + r.bpjs_jkm_employer > 0)
      .sort((a, b) => a.full_name.localeCompare(b.full_name));

      setRows(result);
    } catch (e: any) {
      toast({ title: "Gagal memuat data", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const filtered = rows.filter(r =>
    r.full_name.toLowerCase().includes(search.toLowerCase()) ||
    r.nik.toLowerCase().includes(search.toLowerCase())
  );

  const tot = filtered.reduce((s, r) => ({
    emp_kes: s.emp_kes + r.bpjs_kesehatan,
    emp_kt: s.emp_kt + r.bpjs_ketenagakerjaan,
    er_kes: s.er_kes + r.bpjs_kes_employer,
    er_jht: s.er_jht + r.bpjs_jht_employer,
    er_jp: s.er_jp + r.bpjs_jp_employer,
    er_jkk: s.er_jkk + r.bpjs_jkk_employer,
    er_jkm: s.er_jkm + r.bpjs_jkm_employer,
  }), { emp_kes: 0, emp_kt: 0, er_kes: 0, er_jht: 0, er_jp: 0, er_jkk: 0, er_jkm: 0 });

  const totalEmp = tot.emp_kes + tot.emp_kt;
  const totalEr = tot.er_kes + tot.er_jht + tot.er_jp + tot.er_jkk + tot.er_jkm;
  const periodLabel = selectedMonth === "all" ? `Tahun ${selectedYear}` : `${MONTH_NAMES[(selectedMonth as number) - 1]} ${selectedYear}`;
  const fileSuffix = selectedMonth === "all" ? `${selectedYear}` : `${MONTH_NAMES[(selectedMonth as number) - 1]}_${selectedYear}`;

  const exportExcel = async () => {
    const ExcelJS = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Laporan BPJS");

    const headers = [
      "No", "Nama", "NIK", "Jabatan", "Departemen",
      "BPJS Kesehatan (Karyawan)", "JHT+JP (Karyawan)", "Total Karyawan",
      "BPJS Kesehatan (Perusahaan)", "JHT (Perusahaan)", "JP (Perusahaan)", "JKK (Perusahaan)", "JKM (Perusahaan)", "Total Perusahaan",
      "Grand Total"
    ];
    ws.addRow(headers);
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF008751" } };

    filtered.forEach((r, i) => {
      const empTot = r.bpjs_kesehatan + r.bpjs_ketenagakerjaan;
      const erTot = r.bpjs_kes_employer + r.bpjs_jht_employer + r.bpjs_jp_employer + r.bpjs_jkk_employer + r.bpjs_jkm_employer;
      ws.addRow([
        i + 1, r.full_name, r.nik, r.jabatan, r.departemen,
        r.bpjs_kesehatan, r.bpjs_ketenagakerjaan, empTot,
        r.bpjs_kes_employer, r.bpjs_jht_employer, r.bpjs_jp_employer, r.bpjs_jkk_employer, r.bpjs_jkm_employer, erTot,
        empTot + erTot,
      ]);
    });

    // Totals row
    const totalRow = ws.addRow([
      "", "TOTAL", "", "", "",
      tot.emp_kes, tot.emp_kt, totalEmp,
      tot.er_kes, tot.er_jht, tot.er_jp, tot.er_jkk, tot.er_jkm, totalEr,
      totalEmp + totalEr,
    ]);
    totalRow.font = { bold: true };
    totalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F0F0" } };

    // Format numeric columns
    [6,7,8,9,10,11,12,13,14,15].forEach(c => { ws.getColumn(c).numFmt = '#,##0'; ws.getColumn(c).width = 18; });
    ws.getColumn(1).width = 5; ws.getColumn(2).width = 28; ws.getColumn(3).width = 14;
    ws.getColumn(4).width = 22; ws.getColumn(5).width = 18;

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `Laporan_BPJS_${fileSuffix}.xlsx`;
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
    doc.text("LAPORAN BPJS", mx + 20, 14);
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(`Periode: ${periodLabel} | PT. Kemika Karya Pratama`, mx + 20, 20);
    doc.setDrawColor(0, 135, 81); doc.setLineWidth(0.8);
    doc.line(mx, 26, pw - mx, 26);

    // Summary cards
    let y = 32;
    const cards = [
      { label: "Total Karyawan", value: String(filtered.length) },
      { label: "Iuran Karyawan", value: formatRupiah(totalEmp) },
      { label: "Iuran Perusahaan", value: formatRupiah(totalEr) },
      { label: "Grand Total", value: formatRupiah(totalEmp + totalEr) },
    ];
    const cw = (pw - 2 * mx - 3 * 4) / 4;
    cards.forEach((c, i) => {
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
      head: [[
        "No", "Nama", "NIK",
        "Kes (Kary)", "JHT+JP (Kary)", "Tot Kary",
        "Kes (Per)", "JHT (Per)", "JP (Per)", "JKK (Per)", "JKM (Per)", "Tot Per",
        "Grand Total",
      ]],
      body: filtered.map((r, i) => {
        const empTot = r.bpjs_kesehatan + r.bpjs_ketenagakerjaan;
        const erTot = r.bpjs_kes_employer + r.bpjs_jht_employer + r.bpjs_jp_employer + r.bpjs_jkk_employer + r.bpjs_jkm_employer;
        return [
          i + 1, r.full_name, r.nik,
          formatRupiah(r.bpjs_kesehatan), formatRupiah(r.bpjs_ketenagakerjaan), formatRupiah(empTot),
          formatRupiah(r.bpjs_kes_employer), formatRupiah(r.bpjs_jht_employer), formatRupiah(r.bpjs_jp_employer),
          formatRupiah(r.bpjs_jkk_employer), formatRupiah(r.bpjs_jkm_employer), formatRupiah(erTot),
          formatRupiah(empTot + erTot),
        ];
      }),
      margin: { left: mx, right: mx },
      styles: { fontSize: 6.5, cellPadding: 1.8 },
      headStyles: { fillColor: [0, 135, 81], textColor: 255, fontStyle: "bold", fontSize: 6.5 },
      columnStyles: {
        0: { cellWidth: 8, halign: "center" },
        3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right", fontStyle: "bold" },
        6: { halign: "right" }, 7: { halign: "right" }, 8: { halign: "right" },
        9: { halign: "right" }, 10: { halign: "right" }, 11: { halign: "right", fontStyle: "bold" },
        12: { halign: "right", fontStyle: "bold" },
      },
      foot: [[
        "", "TOTAL", "",
        formatRupiah(tot.emp_kes), formatRupiah(tot.emp_kt), formatRupiah(totalEmp),
        formatRupiah(tot.er_kes), formatRupiah(tot.er_jht), formatRupiah(tot.er_jp),
        formatRupiah(tot.er_jkk), formatRupiah(tot.er_jkm), formatRupiah(totalEr),
        formatRupiah(totalEmp + totalEr),
      ]],
      footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: "bold", fontSize: 6.5 },
    });

    const fy = (doc as any).lastAutoTable?.finalY || y + 60;
    doc.setFontSize(7); doc.setTextColor(128); doc.setFont("helvetica", "normal");
    doc.text(`Dicetak pada: ${new Date().toLocaleString("id-ID")}`, mx, Math.min(fy + 10, ph - 8));
    doc.text("Dokumen ini digenerate otomatis oleh sistem.", pw - mx, Math.min(fy + 10, ph - 8), { align: "right" });

    doc.save(`Laporan_BPJS_${fileSuffix}.pdf`);
    toast({ title: "PDF berhasil di-download" });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Kembali
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" /> Laporan BPJS
                </CardTitle>
                <CardDescription>
                  Rekap iuran BPJS Kesehatan & Ketenagakerjaan (Karyawan + Perusahaan) — sumber dari payroll yang sudah difinalisasi.
                </CardDescription>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(v === "all" ? "all" : Number(v))}>
                  <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Setahun Penuh</SelectItem>
                    {MONTH_NAMES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                  <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={exportExcel} disabled={filtered.length === 0}>
                  <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
                </Button>
                <Button variant="outline" size="sm" onClick={exportPDF} disabled={filtered.length === 0}>
                  <Download className="h-4 w-4 mr-1" /> PDF
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Total Karyawan</p>
                <p className="text-xl font-bold">{filtered.length}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Iuran Karyawan</p>
                <p className="text-lg font-bold text-blue-600">{formatRupiah(totalEmp)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Iuran Perusahaan</p>
                <p className="text-lg font-bold text-emerald-600">{formatRupiah(totalEr)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Grand Total</p>
                <p className="text-lg font-bold text-primary">{formatRupiah(totalEmp + totalEr)}</p>
              </div>
            </div>

            <div className="relative max-w-sm">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Cari nama / NIK..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                Tidak ada data BPJS untuk periode ini. Pastikan payroll periode terkait sudah difinalisasi.
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama</TableHead>
                      <TableHead>NIK</TableHead>
                      <TableHead className="text-right">Kes (Kary)</TableHead>
                      <TableHead className="text-right">JHT+JP (Kary)</TableHead>
                      <TableHead className="text-right font-bold">Tot Kary</TableHead>
                      <TableHead className="text-right">Kes (Per)</TableHead>
                      <TableHead className="text-right">JHT (Per)</TableHead>
                      <TableHead className="text-right">JP (Per)</TableHead>
                      <TableHead className="text-right">JKK (Per)</TableHead>
                      <TableHead className="text-right">JKM (Per)</TableHead>
                      <TableHead className="text-right font-bold">Tot Per</TableHead>
                      <TableHead className="text-right font-bold">Grand Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(r => {
                      const empTot = r.bpjs_kesehatan + r.bpjs_ketenagakerjaan;
                      const erTot = r.bpjs_kes_employer + r.bpjs_jht_employer + r.bpjs_jp_employer + r.bpjs_jkk_employer + r.bpjs_jkm_employer;
                      return (
                        <TableRow key={r.user_id}>
                          <TableCell className="font-medium">{r.full_name}</TableCell>
                          <TableCell className="text-xs">{r.nik}</TableCell>
                          <TableCell className="text-right text-xs">{formatRupiah(r.bpjs_kesehatan)}</TableCell>
                          <TableCell className="text-right text-xs">{formatRupiah(r.bpjs_ketenagakerjaan)}</TableCell>
                          <TableCell className="text-right text-xs font-bold text-blue-600">{formatRupiah(empTot)}</TableCell>
                          <TableCell className="text-right text-xs">{formatRupiah(r.bpjs_kes_employer)}</TableCell>
                          <TableCell className="text-right text-xs">{formatRupiah(r.bpjs_jht_employer)}</TableCell>
                          <TableCell className="text-right text-xs">{formatRupiah(r.bpjs_jp_employer)}</TableCell>
                          <TableCell className="text-right text-xs">{formatRupiah(r.bpjs_jkk_employer)}</TableCell>
                          <TableCell className="text-right text-xs">{formatRupiah(r.bpjs_jkm_employer)}</TableCell>
                          <TableCell className="text-right text-xs font-bold text-emerald-600">{formatRupiah(erTot)}</TableCell>
                          <TableCell className="text-right text-xs font-bold text-primary">{formatRupiah(empTot + erTot)}</TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell colSpan={2}>TOTAL</TableCell>
                      <TableCell className="text-right text-xs">{formatRupiah(tot.emp_kes)}</TableCell>
                      <TableCell className="text-right text-xs">{formatRupiah(tot.emp_kt)}</TableCell>
                      <TableCell className="text-right text-xs text-blue-600">{formatRupiah(totalEmp)}</TableCell>
                      <TableCell className="text-right text-xs">{formatRupiah(tot.er_kes)}</TableCell>
                      <TableCell className="text-right text-xs">{formatRupiah(tot.er_jht)}</TableCell>
                      <TableCell className="text-right text-xs">{formatRupiah(tot.er_jp)}</TableCell>
                      <TableCell className="text-right text-xs">{formatRupiah(tot.er_jkk)}</TableCell>
                      <TableCell className="text-right text-xs">{formatRupiah(tot.er_jkm)}</TableCell>
                      <TableCell className="text-right text-xs text-emerald-600">{formatRupiah(totalEr)}</TableCell>
                      <TableCell className="text-right text-xs text-primary">{formatRupiah(totalEmp + totalEr)}</TableCell>
                    </TableRow>
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

export default BPJSReport;
