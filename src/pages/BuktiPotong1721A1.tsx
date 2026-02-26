import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Loader2, Download } from "lucide-react";
import { formatRupiah, PTKP_VALUES, calculatePPh21Annual } from "@/lib/payrollCalculation";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logo from "@/assets/logo.png";

interface EmployeeTaxSummary {
  user_id: string;
  full_name: string;
  nik: string;
  jabatan: string;
  departemen: string;
  ptkp_status: string;
  ptkp_value: number;
  total_bruto: number;
  total_bpjs_kt: number; // JHT + JP employee only (for Biaya Jabatan calculation)
  biaya_jabatan: number;
  total_netto: number; // Tax netto (Bruto - Biaya Jabatan - JHT - JP)
  total_pph21: number;
  pkp: number;
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

const BuktiPotong1721A1 = () => {
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [data, setData] = useState<EmployeeTaxSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 3 + i);

  useEffect(() => { fetchData(); }, [selectedYear]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Get all finalized periods for the year
      const { data: periods } = await supabase
        .from("payroll_periods").select("id")
        .eq("year", selectedYear).eq("status", "finalized");

      if (!periods || periods.length === 0) { setData([]); setLoading(false); return; }

      const periodIds = periods.map(p => p.id);
      const { data: payrolls } = await supabase
        .from("payroll").select("user_id, bruto_income, bpjs_kesehatan, bpjs_ketenagakerjaan, netto_income, pph21_monthly, ptkp_status, ptkp_value, pkp")
        .in("period_id", periodIds);

      if (!payrolls || payrolls.length === 0) { setData([]); setLoading(false); return; }

      // Aggregate by user
      const userMap = new Map<string, { bruto: number; bpjsKt: number; pph21: number; ptkpStatus: string; ptkpValue: number }>();
      for (const p of payrolls) {
        const existing = userMap.get(p.user_id) || { bruto: 0, bpjsKt: 0, pph21: 0, ptkpStatus: p.ptkp_status, ptkpValue: p.ptkp_value };
        existing.bruto += p.bruto_income;
        existing.bpjsKt += p.bpjs_ketenagakerjaan; // JHT + JP employee only
        existing.pph21 += p.pph21_monthly;
        userMap.set(p.user_id, existing);
      }

      const userIds = [...userMap.keys()];
      const { data: profiles } = await supabase
        .from("profiles").select("id, full_name, nik, jabatan, departemen")
        .in("id", userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      const summaries: EmployeeTaxSummary[] = userIds.map(uid => {
        const agg = userMap.get(uid)!;
        const prof = profileMap.get(uid);
        // Tax netto uses Biaya Jabatan (5%, max 6jt) + JHT + JP employee
        const biayaJabatan = Math.min(agg.bruto * 0.05, 6000000);
        const totalPengurang = biayaJabatan + agg.bpjsKt;
        const taxNetto = agg.bruto - totalPengurang;
        const pkp = Math.max(0, taxNetto - agg.ptkpValue);
        return {
          user_id: uid,
          full_name: prof?.full_name || "Unknown",
          nik: prof?.nik || "-",
          jabatan: prof?.jabatan || "-",
          departemen: prof?.departemen || "-",
          ptkp_status: agg.ptkpStatus,
          ptkp_value: agg.ptkpValue,
          total_bruto: agg.bruto,
          total_bpjs_kt: agg.bpjsKt,
          biaya_jabatan: biayaJabatan,
          total_netto: taxNetto,
          total_pph21: agg.pph21,
          pkp,
        };
      }).sort((a, b) => a.full_name.localeCompare(b.full_name));

      setData(summaries);
    } catch (error: any) {
      toast({ title: "Gagal memuat data", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = async (emp: EmployeeTaxSummary) => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const mx = 15;

    try {
      const logoBase64 = await loadImageAsBase64(logo);
      doc.addImage(logoBase64, "PNG", mx, 10, 20, 20);
    } catch {}

    doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text("PT. KEMIKA KARYA PRATAMA", mx + 24, 18);
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text("Attendance & HR Management System", mx + 24, 24);
    doc.setDrawColor(0, 135, 81); doc.setLineWidth(1);
    doc.line(mx, 34, pageWidth - mx, 34);

    doc.setFontSize(13); doc.setFont("helvetica", "bold");
    doc.text("BUKTI PEMOTONGAN PAJAK PENGHASILAN", pageWidth / 2, 44, { align: "center" });
    doc.setFontSize(11);
    doc.text("PASAL 21 (1721-A1)", pageWidth / 2, 50, { align: "center" });
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(`Tahun Pajak: ${selectedYear}`, pageWidth / 2, 56, { align: "center" });

    // Nomor bukti potong
    const nomorBP = `1.1-${String(data.indexOf(emp) + 1).padStart(4, "0")}-${selectedYear}`;
    doc.text(`Nomor: ${nomorBP}`, mx, 64);

    let y = 72;
    doc.setFontSize(10); doc.setFont("helvetica", "bold");
    doc.text("A. IDENTITAS PENERIMA PENGHASILAN", mx, y); y += 7;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    for (const [label, val] of [
      ["Nama", emp.full_name],
      ["NIK", emp.nik],
      ["Jabatan", emp.jabatan],
      ["Departemen", emp.departemen],
      ["Status PTKP", emp.ptkp_status],
    ]) {
      doc.text(`${label}`, mx, y);
      doc.text(`: ${val}`, mx + 40, y);
      y += 5;
    }
    y += 5;

    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text("B. RINCIAN PENGHASILAN DAN PENGHITUNGAN PPh 21", mx, y); y += 5;

    autoTable(doc, {
      startY: y,
      head: [["No", "Uraian", "Jumlah (Rp)"]],
      body: [
        ["1", "Penghasilan Bruto Setahun", formatRupiah(emp.total_bruto)],
        ["2", "Biaya Jabatan (5%, maks Rp 6.000.000)", `(${formatRupiah(emp.biaya_jabatan)})`],
        ["3", "Iuran JHT + JP Karyawan", `(${formatRupiah(emp.total_bpjs_kt)})`],
        ["4", "Penghasilan Netto Setahun", formatRupiah(emp.total_netto)],
        ["5", `PTKP (${emp.ptkp_status})`, `(${formatRupiah(emp.ptkp_value)})`],
        ["6", "Penghasilan Kena Pajak (PKP)", formatRupiah(emp.pkp)],
        ["7", "PPh 21 Terutang Setahun", formatRupiah(calculatePPh21Annual(emp.pkp))],
        ["8", "PPh 21 Telah Dipotong", formatRupiah(emp.total_pph21)],
        ["9", "Selisih (Kurang/Lebih Bayar)", formatRupiah(calculatePPh21Annual(emp.pkp) - emp.total_pph21)],
      ],
      margin: { left: mx, right: mx },
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [0, 135, 81], textColor: 255, fontStyle: "bold" },
      columnStyles: { 0: { cellWidth: 12, halign: "center" }, 1: { cellWidth: 100 }, 2: { halign: "right" } },
      didParseCell: (data) => {
        const text = String(data.cell.raw);
        if (["Penghasilan Kena Pajak (PKP)", "PPh 21 Terutang Setahun", "Selisih (Kurang/Lebih Bayar)"].some(s => text.includes(s))) {
          data.cell.styles.fontStyle = "bold";
        }
      },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || y + 80;

    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text("Demikian bukti pemotongan ini dibuat dengan sebenarnya.", mx, finalY + 12);

    const signX = pageWidth - mx - 60;
    doc.text(`Jakarta, ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`, signX, finalY + 20);
    doc.text("Pemotong Pajak,", signX, finalY + 26);
    doc.text("PT. Kemika Karya Pratama", signX, finalY + 46);

    doc.setFontSize(7); doc.setTextColor(128);
    doc.text("Dokumen ini digenerate secara otomatis oleh sistem.", mx, finalY + 55);
    doc.text(`Dicetak pada: ${new Date().toLocaleString("id-ID")}`, mx, finalY + 59);

    doc.save(`1721-A1_${emp.full_name.replace(/\s+/g, "_")}_${selectedYear}.pdf`);
    toast({ title: "PDF 1721-A1 berhasil di-download" });
  };

  const generateAllPDF = async () => {
    for (const emp of data) {
      await generatePDF(emp);
    }
    toast({ title: "Semua Bukti Potong berhasil di-download", description: `${data.length} file PDF` });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-7 w-7 text-primary" /> Bukti Potong 1721-A1
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Generate otomatis bukti pemotongan PPh 21 tahunan per karyawan
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
              <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
            {data.length > 0 && (
              <Button onClick={generateAllPDF} variant="outline" className="gap-2">
                <Download className="h-4 w-4" /> Download Semua PDF
              </Button>
            )}
          </div>
        </div>

        {data.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card><CardContent className="pt-6"><p className="text-2xl font-bold">{data.length}</p><p className="text-xs text-muted-foreground">Total Karyawan</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-lg font-bold">{formatRupiah(data.reduce((s, d) => s + d.total_bruto, 0))}</p><p className="text-xs text-muted-foreground">Total Bruto Tahunan</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-lg font-bold text-destructive">{formatRupiah(data.reduce((s, d) => s + d.total_pph21, 0))}</p><p className="text-xs text-muted-foreground">Total PPh 21 Tahunan</p></CardContent></Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Data Pajak Tahunan — {selectedYear}</CardTitle>
            <CardDescription>Berdasarkan payroll yang sudah difinalisasi</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : data.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Belum ada data payroll yang difinalisasi</p>
                <p className="text-sm mt-1">Finalisasi payroll terlebih dahulu untuk membuat bukti potong</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">No</TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead>NIK</TableHead>
                      <TableHead>PTKP</TableHead>
                      <TableHead className="text-right">Bruto Tahunan</TableHead>
                      <TableHead className="text-right">PPh 21</TableHead>
                      <TableHead className="text-right">PKP</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map((emp, idx) => (
                      <TableRow key={emp.user_id}>
                        <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-medium">{emp.full_name}</TableCell>
                        <TableCell className="text-sm">{emp.nik}</TableCell>
                        <TableCell><Badge variant="outline">{emp.ptkp_status}</Badge></TableCell>
                        <TableCell className="text-right text-sm">{formatRupiah(emp.total_bruto)}</TableCell>
                        <TableCell className="text-right text-sm text-destructive">{formatRupiah(emp.total_pph21)}</TableCell>
                        <TableCell className="text-right text-sm">{formatRupiah(emp.pkp)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="h-7 px-2 gap-1" onClick={() => generatePDF(emp)}>
                            <Download className="h-3.5 w-3.5" /> PDF
                          </Button>
                        </TableCell>
                      </TableRow>
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

export default BuktiPotong1721A1;
