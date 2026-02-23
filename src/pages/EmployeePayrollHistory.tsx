import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmployeeBottomNav } from "@/components/EmployeeBottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatRupiah } from "@/lib/payrollCalculation";
import { ArrowLeft, DollarSign, Download, Loader2, LogOut } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logo from "@/assets/logo.png";

const MONTHS = [
  { value: 1, label: "Januari" }, { value: 2, label: "Februari" }, { value: 3, label: "Maret" },
  { value: 4, label: "April" }, { value: 5, label: "Mei" }, { value: 6, label: "Juni" },
  { value: 7, label: "Juli" }, { value: 8, label: "Agustus" }, { value: 9, label: "September" },
  { value: 10, label: "Oktober" }, { value: 11, label: "November" }, { value: 12, label: "Desember" },
];

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

interface PayrollItem {
  id: string;
  basic_salary: number;
  allowance: number;
  overtime_total: number;
  overtime_hours: number;
  bruto_income: number;
  bpjs_kesehatan: number;
  bpjs_ketenagakerjaan: number;
  bpjs_kes_employer: number;
  bpjs_jht_employer: number;
  bpjs_jp_employer: number;
  netto_income: number;
  ptkp_status: string;
  ptkp_value: number;
  pkp: number;
  pph21_monthly: number;
  take_home_pay: number;
  loan_deduction: number;
  other_deduction: number;
  deduction_notes: string | null;
  period_id: string;
}

interface PeriodInfo {
  id: string;
  month: number;
  year: number;
  status: string;
}

const EmployeePayrollHistory = () => {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [payrolls, setPayrolls] = useState<(PayrollItem & { month: number; year: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailItem, setDetailItem] = useState<(PayrollItem & { month: number; year: number }) | null>(null);

  const years = Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - i);

  useEffect(() => {
    if (user) fetchPayrolls();
  }, [user, selectedYear]);

  const fetchPayrolls = async () => {
    setLoading(true);
    try {
      // Get finalized periods for selected year
      const { data: periods } = await supabase
        .from("payroll_periods")
        .select("id, month, year, status")
        .eq("year", selectedYear)
        .eq("status", "finalized")
        .order("month", { ascending: false });

      if (!periods || periods.length === 0) { setPayrolls([]); setLoading(false); return; }

      const periodIds = periods.map(p => p.id);
      const periodMap = new Map(periods.map(p => [p.id, p]));

      const { data: payrollData } = await supabase
        .from("payroll")
        .select("*")
        .eq("user_id", user!.id)
        .in("period_id", periodIds);

      const enriched = (payrollData || []).map(p => {
        const per = periodMap.get(p.period_id)!;
        return { ...p, month: per.month, year: per.year };
      });

      enriched.sort((a, b) => b.month - a.month);
      setPayrolls(enriched);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const generateSlipPDF = async (item: PayrollItem & { month: number; year: number }) => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 15;

    try {
      const logoBase64 = await loadImageAsBase64(logo);
      doc.addImage(logoBase64, "PNG", marginX, 10, 20, 20);
    } catch {}

    doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text("PT. KEMIKA KARYA PRATAMA", marginX + 24, 18);
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text("Attendance & HR Management System", marginX + 24, 24);

    doc.setDrawColor(0, 135, 81); doc.setLineWidth(1);
    doc.line(marginX, 34, pageWidth - marginX, 34);

    doc.setFontSize(12); doc.setFont("helvetica", "bold");
    doc.text("SLIP GAJI", pageWidth / 2, 42, { align: "center" });
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text(`Periode: ${MONTHS[item.month - 1].label} ${item.year}`, pageWidth / 2, 48, { align: "center" });

    let y = 56;
    doc.setFontSize(9);
    const infoLines = [
      ["Nama", profile?.full_name || "-"],
      ["NIK", profile?.nik || "-"],
      ["Jabatan", profile?.jabatan || "-"],
      ["Departemen", profile?.departemen || "-"],
      ["Status PTKP", item.ptkp_status],
    ];
    for (const [label, val] of infoLines) {
      doc.text(`${label}`, marginX, y);
      doc.text(`: ${val}`, marginX + 35, y);
      y += 5;
    }
    y += 3;

    // Calculate attendance-only allowance (total allowance minus fixed allowances from profile)
    const tunjanganKomunikasi = Number((profile as any)?.tunjangan_komunikasi) || 0;
    const tunjanganJabatan = Number((profile as any)?.tunjangan_jabatan) || 0;
    const tunjanganOperasional = Number((profile as any)?.tunjangan_operasional) || 0;
    const fixedTotal = tunjanganKomunikasi + tunjanganJabatan + tunjanganOperasional;
    const attendanceAllowance = Math.max(0, item.allowance - fixedTotal);

    const rows: string[][] = [
      ["Gaji Pokok", formatRupiah(item.basic_salary), ""],
      ["Tunjangan Kehadiran", formatRupiah(attendanceAllowance), ""],
      ...(tunjanganKomunikasi > 0 ? [["Tunjangan Komunikasi", formatRupiah(tunjanganKomunikasi), ""]] : []),
      ...(tunjanganJabatan > 0 ? [["Tunjangan Jabatan", formatRupiah(tunjanganJabatan), ""]] : []),
      ...(tunjanganOperasional > 0 ? [["Tunjangan Operasional", formatRupiah(tunjanganOperasional), ""]] : []),
      [`Lembur (${item.overtime_hours} jam)`, formatRupiah(item.overtime_total), ""],
      ["", "", ""],
      ["BRUTO", "", formatRupiah(item.bruto_income)],
      ["", "", ""],
      ["Pot. BPJS Kesehatan (1%)", "", `- ${formatRupiah(item.bpjs_kesehatan)}`],
      ["Pot. BPJS TK + JP (3%)", "", `- ${formatRupiah(item.bpjs_ketenagakerjaan)}`],
      ...(item.loan_deduction > 0 ? [["Pot. Pinjaman/Kasbon", "", `- ${formatRupiah(item.loan_deduction)}`]] : []),
      ...(item.other_deduction > 0 ? [["Pot. Lainnya", "", `- ${formatRupiah(item.other_deduction)}`]] : []),
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
      columnStyles: { 0: { cellWidth: 80 }, 1: { halign: "right", cellWidth: 45 }, 2: { halign: "right", cellWidth: 45 } },
      didParseCell: (data) => {
        const text = String(data.cell.raw);
        if (["BRUTO", "NETTO", "TAKE HOME PAY"].includes(text)) data.cell.styles.fontStyle = "bold";
        if (text === "TAKE HOME PAY") data.cell.styles.fillColor = [240, 255, 245];
      },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || y + 80;

    // Employer BPJS info
    doc.setFontSize(8); doc.setTextColor(100);
    doc.text("Kontribusi Perusahaan (tidak dipotong dari gaji):", marginX, finalY + 8);
    doc.text(`BPJS Kes 4%: ${formatRupiah(item.bpjs_kes_employer)} | JHT 3.7%: ${formatRupiah(item.bpjs_jht_employer)} | JP 2%: ${formatRupiah(item.bpjs_jp_employer)}`, marginX, finalY + 13);

    doc.setTextColor(128);
    doc.text("Dokumen ini digenerate secara otomatis oleh sistem.", marginX, finalY + 20);
    doc.text(`Dicetak pada: ${new Date().toLocaleString("id-ID")}`, marginX, finalY + 25);

    doc.save(`Slip_Gaji_${profile?.full_name?.replace(/\s+/g, "_")}_${MONTHS[item.month - 1].label}_${item.year}.pdf`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/10 pb-24">
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/employee/self-service")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <img src={logo} alt="Kemika" className="h-8 object-contain" />
          </div>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-lg space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <DollarSign className="h-6 w-6 text-primary" /> Slip Gaji
            </h1>
            <p className="text-sm text-muted-foreground">Riwayat slip gaji Anda</p>
          </div>
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : payrolls.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Belum ada slip gaji</p>
              <p className="text-sm">Slip gaji akan muncul setelah payroll difinalisasi oleh admin.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {payrolls.map((p) => (
              <Card key={p.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDetailItem(p)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{MONTHS[p.month - 1].label} {p.year}</p>
                      <p className="text-sm text-muted-foreground">Gaji Pokok: {formatRupiah(p.basic_salary)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">{formatRupiah(p.take_home_pay)}</p>
                      <Badge variant="outline" className="text-[10px]">THP</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!detailItem} onOpenChange={(open) => !open && setDetailItem(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detail Slip Gaji</DialogTitle>
            <DialogDescription>{profile?.full_name} — {detailItem && `${MONTHS[detailItem.month - 1].label} ${detailItem.year}`}</DialogDescription>
          </DialogHeader>
          {detailItem && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 border-b border-border pb-3">
                <span className="text-muted-foreground">Gaji Pokok</span>
                <span className="text-right font-medium">{formatRupiah(detailItem.basic_salary)}</span>
                <span className="text-muted-foreground">Tunjangan Kehadiran</span>
                <span className="text-right">{formatRupiah(Math.max(0, detailItem.allowance - (Number((profile as any)?.tunjangan_komunikasi) || 0) - (Number((profile as any)?.tunjangan_jabatan) || 0) - (Number((profile as any)?.tunjangan_operasional) || 0)))}</span>
                <span className="text-muted-foreground">Lembur ({detailItem.overtime_hours} jam)</span>
                <span className="text-right">{formatRupiah(detailItem.overtime_total)}</span>
              </div>
              {/* Fixed Allowances Breakdown */}
              {((Number((profile as any)?.tunjangan_komunikasi) || 0) + (Number((profile as any)?.tunjangan_jabatan) || 0) + (Number((profile as any)?.tunjangan_operasional) || 0)) > 0 && (
                <div className="grid grid-cols-2 gap-2 border-b border-border pb-3 bg-muted/30 rounded p-2">
                  <span className="col-span-2 text-xs font-semibold text-muted-foreground mb-1">📋 Tunjangan Tetap</span>
                  {(Number((profile as any)?.tunjangan_komunikasi) || 0) > 0 && <>
                    <span className="text-muted-foreground text-xs">Tunjangan Komunikasi</span>
                    <span className="text-right text-xs">{formatRupiah(Number((profile as any)?.tunjangan_komunikasi))}</span>
                  </>}
                  {(Number((profile as any)?.tunjangan_jabatan) || 0) > 0 && <>
                    <span className="text-muted-foreground text-xs">Tunjangan Jabatan</span>
                    <span className="text-right text-xs">{formatRupiah(Number((profile as any)?.tunjangan_jabatan))}</span>
                  </>}
                  {(Number((profile as any)?.tunjangan_operasional) || 0) > 0 && <>
                    <span className="text-muted-foreground text-xs">Tunjangan Operasional</span>
                    <span className="text-right text-xs">{formatRupiah(Number((profile as any)?.tunjangan_operasional))}</span>
                  </>}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 border-b border-border pb-3">
                <span className="font-semibold">Bruto</span>
                <span className="text-right font-semibold">{formatRupiah(detailItem.bruto_income)}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 border-b border-border pb-3">
                <span className="text-muted-foreground">BPJS Kesehatan (1%)</span>
                <span className="text-right text-destructive">-{formatRupiah(detailItem.bpjs_kesehatan)}</span>
                <span className="text-muted-foreground">BPJS TK + JP (3%)</span>
                <span className="text-right text-destructive">-{formatRupiah(detailItem.bpjs_ketenagakerjaan)}</span>
                {detailItem.loan_deduction > 0 && <>
                  <span className="text-muted-foreground">Pinjaman/Kasbon</span>
                  <span className="text-right text-destructive">-{formatRupiah(detailItem.loan_deduction)}</span>
                </>}
                {detailItem.other_deduction > 0 && <>
                  <span className="text-muted-foreground">Potongan Lain</span>
                  <span className="text-right text-destructive">-{formatRupiah(detailItem.other_deduction)}</span>
                </>}
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

              {/* Employer BPJS section */}
              <div className="grid grid-cols-2 gap-2 border-b border-border pb-3 bg-muted/30 rounded p-2">
                <span className="col-span-2 text-xs font-semibold text-muted-foreground mb-1">Kontribusi Perusahaan</span>
                <span className="text-muted-foreground text-xs">BPJS Kes (4%)</span>
                <span className="text-right text-xs">{formatRupiah(detailItem.bpjs_kes_employer)}</span>
                <span className="text-muted-foreground text-xs">JHT (3.7%)</span>
                <span className="text-right text-xs">{formatRupiah(detailItem.bpjs_jht_employer)}</span>
                <span className="text-muted-foreground text-xs">JP (2%)</span>
                <span className="text-right text-xs">{formatRupiah(detailItem.bpjs_jp_employer)}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <span className="text-base font-bold">Take Home Pay</span>
                <span className="text-right text-base font-bold text-primary">{formatRupiah(detailItem.take_home_pay)}</span>
              </div>

              <div className="pt-3 border-t border-border">
                <Button onClick={() => generateSlipPDF(detailItem)} className="w-full gap-2">
                  <Download className="h-4 w-4" /> Download Slip Gaji PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <EmployeeBottomNav />
    </div>
  );
};

export default EmployeePayrollHistory;
