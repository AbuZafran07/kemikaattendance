import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Download, FileSpreadsheet, Search, ArrowLeft, Shield, Info, Calendar } from "lucide-react";
import { formatRupiah } from "@/lib/payrollCalculation";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logo from "@/assets/logo.png";
import { useNavigate } from "react-router-dom";

const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

interface RawItem {
  user_id: string;
  period_id: string;
  month: number;
  bpjs_kesehatan: number;
  bpjs_ketenagakerjaan: number;
  bpjs_kes_employer: number;
  bpjs_jht_employer: number;
  bpjs_jp_employer: number;
  bpjs_jkk_employer: number;
  bpjs_jkm_employer: number;
}

interface ProfileInfo {
  full_name: string;
  nik: string;
  jabatan: string;
  departemen: string;
}

interface Row extends ProfileInfo {
  user_id: string;
  bpjs_kesehatan: number;
  bpjs_ketenagakerjaan: number;
  bpjs_kes_employer: number;
  bpjs_jht_employer: number;
  bpjs_jp_employer: number;
  bpjs_jkk_employer: number;
  bpjs_jkm_employer: number;
}

const currentYear = new Date().getFullYear();

const emptyTotals = () => ({
  bpjs_kesehatan: 0, bpjs_ketenagakerjaan: 0,
  bpjs_kes_employer: 0, bpjs_jht_employer: 0, bpjs_jp_employer: 0,
  bpjs_jkk_employer: 0, bpjs_jkm_employer: 0,
});

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
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [jabatanFilter, setJabatanFilter] = useState<string>("all");
  const [showMonthly, setShowMonthly] = useState(false);
  const [items, setItems] = useState<RawItem[]>([]);
  const [profiles, setProfiles] = useState<Map<string, ProfileInfo>>(new Map());
  const [bpjsBase, setBpjsBase] = useState<"basic" | "basic_plus_fixed">("basic");
  const [baseEffectiveDate, setBaseEffectiveDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 3 + i);

  useEffect(() => { fetchData(); }, [selectedYear, selectedMonth]);
  useEffect(() => { fetchBpjsConfig(); }, []);

  const fetchBpjsConfig = async () => {
    const { data } = await supabase.rpc("get_bpjs_config");
    const cfg = (data as any) || {};
    setBpjsBase(cfg.base_calculation ?? "basic");
    setBaseEffectiveDate(cfg.base_calculation_effective_date ?? null);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      let q = supabase.from("payroll_periods").select("id, month").eq("year", selectedYear).eq("status", "finalized");
      if (selectedMonth !== "all") q = q.eq("month", selectedMonth as number);
      const { data: periods } = await q;

      if (!periods || periods.length === 0) { setItems([]); setProfiles(new Map()); return; }
      const periodMonthMap = new Map(periods.map(p => [p.id, p.month]));
      const periodIds = periods.map(p => p.id);

      const { data: payrolls } = await supabase
        .from("payroll")
        .select("user_id, period_id, bpjs_kesehatan, bpjs_ketenagakerjaan, bpjs_kes_employer, bpjs_jht_employer, bpjs_jp_employer, bpjs_jkk_employer, bpjs_jkm_employer")
        .in("period_id", periodIds);

      if (!payrolls || payrolls.length === 0) { setItems([]); setProfiles(new Map()); return; }

      const rawItems: RawItem[] = payrolls.map(p => ({
        user_id: p.user_id,
        period_id: p.period_id,
        month: periodMonthMap.get(p.period_id) || 0,
        bpjs_kesehatan: Number(p.bpjs_kesehatan) || 0,
        bpjs_ketenagakerjaan: Number(p.bpjs_ketenagakerjaan) || 0,
        bpjs_kes_employer: Number(p.bpjs_kes_employer) || 0,
        bpjs_jht_employer: Number(p.bpjs_jht_employer) || 0,
        bpjs_jp_employer: Number(p.bpjs_jp_employer) || 0,
        bpjs_jkk_employer: Number(p.bpjs_jkk_employer) || 0,
        bpjs_jkm_employer: Number(p.bpjs_jkm_employer) || 0,
      }));

      const userIds = [...new Set(rawItems.map(i => i.user_id))];
      const { data: profs } = await supabase
        .from("profiles").select("id, full_name, nik, jabatan, departemen")
        .in("id", userIds);
      const pmap = new Map<string, ProfileInfo>((profs || []).map(p => [p.id, {
        full_name: p.full_name, nik: p.nik, jabatan: p.jabatan, departemen: p.departemen,
      }]));

      setItems(rawItems);
      setProfiles(pmap);
    } catch (e: any) {
      toast({ title: "Gagal memuat data", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  // Derived filter options
  const departmentOptions = useMemo(() => {
    const set = new Set<string>();
    profiles.forEach(p => p.departemen && set.add(p.departemen));
    return [...set].sort();
  }, [profiles]);

  const jabatanOptions = useMemo(() => {
    const set = new Set<string>();
    profiles.forEach(p => p.departemen && (departmentFilter === "all" || p.departemen === departmentFilter) && p.jabatan && set.add(p.jabatan));
    return [...set].sort();
  }, [profiles, departmentFilter]);

  // Items filtered by department/jabatan/search
  const filteredItems = useMemo(() => {
    return items.filter(it => {
      const pr = profiles.get(it.user_id);
      if (!pr) return false;
      if (departmentFilter !== "all" && pr.departemen !== departmentFilter) return false;
      if (jabatanFilter !== "all" && pr.jabatan !== jabatanFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!pr.full_name.toLowerCase().includes(s) && !pr.nik.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [items, profiles, departmentFilter, jabatanFilter, search]);

  // Aggregated per-employee rows (default view)
  const rows: Row[] = useMemo(() => {
    const m = new Map<string, Row>();
    for (const it of filteredItems) {
      const pr = profiles.get(it.user_id)!;
      const cur = m.get(it.user_id) || {
        user_id: it.user_id, ...pr, ...emptyTotals(),
      };
      cur.bpjs_kesehatan += it.bpjs_kesehatan;
      cur.bpjs_ketenagakerjaan += it.bpjs_ketenagakerjaan;
      cur.bpjs_kes_employer += it.bpjs_kes_employer;
      cur.bpjs_jht_employer += it.bpjs_jht_employer;
      cur.bpjs_jp_employer += it.bpjs_jp_employer;
      cur.bpjs_jkk_employer += it.bpjs_jkk_employer;
      cur.bpjs_jkm_employer += it.bpjs_jkm_employer;
      m.set(it.user_id, cur);
    }
    return [...m.values()]
      .filter(r => r.bpjs_kesehatan + r.bpjs_ketenagakerjaan + r.bpjs_kes_employer + r.bpjs_jht_employer + r.bpjs_jp_employer + r.bpjs_jkk_employer + r.bpjs_jkm_employer > 0)
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [filteredItems, profiles]);

  // Aggregated per-month (only useful when "Setahun Penuh")
  const monthlyAggregate = useMemo(() => {
    const m = new Map<number, ReturnType<typeof emptyTotals> & { count: Set<string> }>();
    for (const it of filteredItems) {
      const cur = m.get(it.month) || { ...emptyTotals(), count: new Set<string>() };
      cur.bpjs_kesehatan += it.bpjs_kesehatan;
      cur.bpjs_ketenagakerjaan += it.bpjs_ketenagakerjaan;
      cur.bpjs_kes_employer += it.bpjs_kes_employer;
      cur.bpjs_jht_employer += it.bpjs_jht_employer;
      cur.bpjs_jp_employer += it.bpjs_jp_employer;
      cur.bpjs_jkk_employer += it.bpjs_jkk_employer;
      cur.bpjs_jkm_employer += it.bpjs_jkm_employer;
      cur.count.add(it.user_id);
      m.set(it.month, cur);
    }
    return [...m.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([month, v]) => ({ month, ...v, employees: v.count.size }));
  }, [filteredItems]);

  const tot = rows.reduce((s, r) => ({
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
  const isYearView = selectedMonth === "all";
  const showMonthlyView = isYearView && showMonthly;

  const baseLabel = bpjsBase === "basic_plus_fixed" ? "Gaji Pokok + Tunjangan Tetap" : "Gaji Pokok";
  const baseDateLabel = baseEffectiveDate
    ? new Date(baseEffectiveDate).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })
    : "—";

  const filterChip = () => {
    const parts: string[] = [];
    if (departmentFilter !== "all") parts.push(`Dept: ${departmentFilter}`);
    if (jabatanFilter !== "all") parts.push(`Jabatan: ${jabatanFilter}`);
    return parts.length ? ` | Filter: ${parts.join(", ")}` : "";
  };

  const exportExcel = async () => {
    const ExcelJS = await import("exceljs");
    const wb = new ExcelJS.Workbook();

    // Info sheet
    const info = wb.addWorksheet("Info");
    info.addRow(["LAPORAN BPJS"]).font = { bold: true, size: 14 };
    info.addRow(["Periode", periodLabel]);
    info.addRow(["Departemen", departmentFilter === "all" ? "Semua" : departmentFilter]);
    info.addRow(["Jabatan", jabatanFilter === "all" ? "Semua" : jabatanFilter]);
    info.addRow(["Dasar Perhitungan BPJS", baseLabel]);
    info.addRow(["Berlaku Efektif Sejak", baseDateLabel]);
    info.addRow(["Dicetak", new Date().toLocaleString("id-ID")]);
    info.getColumn(1).width = 28; info.getColumn(2).width = 40;

    // Per-employee sheet
    const ws = wb.addWorksheet("Rekap Karyawan");
    const headers = [
      "No", "Nama", "NIK", "Jabatan", "Departemen",
      "BPJS Kesehatan (Karyawan)", "JHT+JP (Karyawan)", "Total Karyawan",
      "BPJS Kesehatan (Perusahaan)", "JHT (Perusahaan)", "JP (Perusahaan)", "JKK (Perusahaan)", "JKM (Perusahaan)", "Total Perusahaan",
      "Grand Total"
    ];
    ws.addRow(headers);
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF008751" } };

    rows.forEach((r, i) => {
      const empTot = r.bpjs_kesehatan + r.bpjs_ketenagakerjaan;
      const erTot = r.bpjs_kes_employer + r.bpjs_jht_employer + r.bpjs_jp_employer + r.bpjs_jkk_employer + r.bpjs_jkm_employer;
      ws.addRow([
        i + 1, r.full_name, r.nik, r.jabatan, r.departemen,
        r.bpjs_kesehatan, r.bpjs_ketenagakerjaan, empTot,
        r.bpjs_kes_employer, r.bpjs_jht_employer, r.bpjs_jp_employer, r.bpjs_jkk_employer, r.bpjs_jkm_employer, erTot,
        empTot + erTot,
      ]);
    });

    const totalRow = ws.addRow([
      "", "TOTAL", "", "", "",
      tot.emp_kes, tot.emp_kt, totalEmp,
      tot.er_kes, tot.er_jht, tot.er_jp, tot.er_jkk, tot.er_jkm, totalEr,
      totalEmp + totalEr,
    ]);
    totalRow.font = { bold: true };
    totalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F0F0" } };

    [6,7,8,9,10,11,12,13,14,15].forEach(c => { ws.getColumn(c).numFmt = '#,##0'; ws.getColumn(c).width = 18; });
    ws.getColumn(1).width = 5; ws.getColumn(2).width = 28; ws.getColumn(3).width = 14;
    ws.getColumn(4).width = 22; ws.getColumn(5).width = 22;

    // Per-month sheet (only when year view)
    if (isYearView && monthlyAggregate.length > 0) {
      const wm = wb.addWorksheet("Rekap Per Bulan");
      const mh = ["Bulan", "Jumlah Karyawan",
        "Kes (Karyawan)", "JHT+JP (Karyawan)", "Total Karyawan",
        "Kes (Perusahaan)", "JHT (Perusahaan)", "JP (Perusahaan)", "JKK (Perusahaan)", "JKM (Perusahaan)", "Total Perusahaan",
        "Grand Total"];
      wm.addRow(mh);
      wm.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      wm.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF008751" } };
      monthlyAggregate.forEach(mo => {
        const empT = mo.bpjs_kesehatan + mo.bpjs_ketenagakerjaan;
        const erT = mo.bpjs_kes_employer + mo.bpjs_jht_employer + mo.bpjs_jp_employer + mo.bpjs_jkk_employer + mo.bpjs_jkm_employer;
        wm.addRow([
          MONTH_NAMES[mo.month - 1], mo.employees,
          mo.bpjs_kesehatan, mo.bpjs_ketenagakerjaan, empT,
          mo.bpjs_kes_employer, mo.bpjs_jht_employer, mo.bpjs_jp_employer, mo.bpjs_jkk_employer, mo.bpjs_jkm_employer, erT,
          empT + erT,
        ]);
      });
      const tEmp = monthlyAggregate.reduce((s, m) => s + m.bpjs_kesehatan + m.bpjs_ketenagakerjaan, 0);
      const tEr = monthlyAggregate.reduce((s, m) => s + m.bpjs_kes_employer + m.bpjs_jht_employer + m.bpjs_jp_employer + m.bpjs_jkk_employer + m.bpjs_jkm_employer, 0);
      const tr = wm.addRow([
        "TOTAL", "",
        monthlyAggregate.reduce((s, m) => s + m.bpjs_kesehatan, 0),
        monthlyAggregate.reduce((s, m) => s + m.bpjs_ketenagakerjaan, 0),
        tEmp,
        monthlyAggregate.reduce((s, m) => s + m.bpjs_kes_employer, 0),
        monthlyAggregate.reduce((s, m) => s + m.bpjs_jht_employer, 0),
        monthlyAggregate.reduce((s, m) => s + m.bpjs_jp_employer, 0),
        monthlyAggregate.reduce((s, m) => s + m.bpjs_jkk_employer, 0),
        monthlyAggregate.reduce((s, m) => s + m.bpjs_jkm_employer, 0),
        tEr,
        tEmp + tEr,
      ]);
      tr.font = { bold: true };
      tr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F0F0" } };
      [3,4,5,6,7,8,9,10,11,12].forEach(c => { wm.getColumn(c).numFmt = '#,##0'; wm.getColumn(c).width = 18; });
      wm.getColumn(1).width = 14; wm.getColumn(2).width = 16;
    }

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
    doc.text(`Periode: ${periodLabel}${filterChip()} | PT. Kemika Karya Pratama`, mx + 20, 20);
    doc.setFontSize(8);
    doc.text(`Dasar Perhitungan BPJS: ${baseLabel}  |  Berlaku efektif sejak: ${baseDateLabel}`, mx + 20, 24.5);
    doc.setDrawColor(0, 135, 81); doc.setLineWidth(0.8);
    doc.line(mx, 28, pw - mx, 28);

    let y = 34;
    const cards = [
      { label: "Total Karyawan", value: String(rows.length) },
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
        "No", "Nama", "NIK", "Jabatan", "Dept",
        "Kes (Kary)", "JHT+JP (Kary)", "Tot Kary",
        "Kes (Per)", "JHT (Per)", "JP (Per)", "JKK (Per)", "JKM (Per)", "Tot Per",
        "Grand Total",
      ]],
      body: rows.map((r, i) => {
        const empTot = r.bpjs_kesehatan + r.bpjs_ketenagakerjaan;
        const erTot = r.bpjs_kes_employer + r.bpjs_jht_employer + r.bpjs_jp_employer + r.bpjs_jkk_employer + r.bpjs_jkm_employer;
        return [
          i + 1, r.full_name, r.nik, r.jabatan, r.departemen,
          formatRupiah(r.bpjs_kesehatan), formatRupiah(r.bpjs_ketenagakerjaan), formatRupiah(empTot),
          formatRupiah(r.bpjs_kes_employer), formatRupiah(r.bpjs_jht_employer), formatRupiah(r.bpjs_jp_employer),
          formatRupiah(r.bpjs_jkk_employer), formatRupiah(r.bpjs_jkm_employer), formatRupiah(erTot),
          formatRupiah(empTot + erTot),
        ];
      }),
      margin: { left: mx, right: mx },
      styles: { fontSize: 6, cellPadding: 1.4 },
      headStyles: { fillColor: [0, 135, 81], textColor: 255, fontStyle: "bold", fontSize: 6 },
      columnStyles: {
        0: { cellWidth: 7, halign: "center" },
        5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right", fontStyle: "bold" },
        8: { halign: "right" }, 9: { halign: "right" }, 10: { halign: "right" },
        11: { halign: "right" }, 12: { halign: "right" }, 13: { halign: "right", fontStyle: "bold" },
        14: { halign: "right", fontStyle: "bold" },
      },
      foot: [[
        "", "TOTAL", "", "", "",
        formatRupiah(tot.emp_kes), formatRupiah(tot.emp_kt), formatRupiah(totalEmp),
        formatRupiah(tot.er_kes), formatRupiah(tot.er_jht), formatRupiah(tot.er_jp),
        formatRupiah(tot.er_jkk), formatRupiah(tot.er_jkm), formatRupiah(totalEr),
        formatRupiah(totalEmp + totalEr),
      ]],
      footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: "bold", fontSize: 6 },
    });

    // Per-month section
    if (isYearView && monthlyAggregate.length > 0) {
      const lastY = (doc as any).lastAutoTable?.finalY || y + 60;
      doc.addPage();
      doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(0);
      doc.text(`Rincian Iuran BPJS Per Bulan — ${selectedYear}`, mx, 14);
      doc.setDrawColor(0, 135, 81); doc.setLineWidth(0.6);
      doc.line(mx, 17, pw - mx, 17);

      autoTable(doc, {
        startY: 22,
        head: [[
          "Bulan", "Karyawan",
          "Kes (Kary)", "JHT+JP (Kary)", "Tot Kary",
          "Kes (Per)", "JHT (Per)", "JP (Per)", "JKK (Per)", "JKM (Per)", "Tot Per",
          "Grand Total",
        ]],
        body: monthlyAggregate.map(mo => {
          const empT = mo.bpjs_kesehatan + mo.bpjs_ketenagakerjaan;
          const erT = mo.bpjs_kes_employer + mo.bpjs_jht_employer + mo.bpjs_jp_employer + mo.bpjs_jkk_employer + mo.bpjs_jkm_employer;
          return [
            MONTH_NAMES[mo.month - 1], mo.employees,
            formatRupiah(mo.bpjs_kesehatan), formatRupiah(mo.bpjs_ketenagakerjaan), formatRupiah(empT),
            formatRupiah(mo.bpjs_kes_employer), formatRupiah(mo.bpjs_jht_employer), formatRupiah(mo.bpjs_jp_employer),
            formatRupiah(mo.bpjs_jkk_employer), formatRupiah(mo.bpjs_jkm_employer), formatRupiah(erT),
            formatRupiah(empT + erT),
          ];
        }),
        margin: { left: mx, right: mx },
        styles: { fontSize: 7, cellPadding: 1.6 },
        headStyles: { fillColor: [0, 135, 81], textColor: 255, fontStyle: "bold", fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 22 }, 1: { halign: "center", cellWidth: 18 },
          2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right", fontStyle: "bold" },
          5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" },
          8: { halign: "right" }, 9: { halign: "right" }, 10: { halign: "right", fontStyle: "bold" },
          11: { halign: "right", fontStyle: "bold" },
        },
      });
    }

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
                <Button variant="outline" size="sm" onClick={exportExcel} disabled={rows.length === 0}>
                  <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
                </Button>
                <Button variant="outline" size="sm" onClick={exportPDF} disabled={rows.length === 0}>
                  <Download className="h-4 w-4 mr-1" /> PDF
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Effective date banner */}
            <Alert className="border-primary/30 bg-primary/5">
              <Calendar className="h-4 w-4 text-primary" />
              <AlertDescription className="text-xs sm:text-sm">
                <strong>Dasar Perhitungan BPJS aktif:</strong> {baseLabel}
                {baseEffectiveDate && (
                  <> &nbsp;•&nbsp; <strong>Berlaku efektif sejak:</strong> {baseDateLabel}</>
                )}
                {!baseEffectiveDate && (
                  <span className="text-muted-foreground"> &nbsp;•&nbsp; Tanggal efektif belum tercatat (akan otomatis terisi saat dasar perhitungan diubah).</span>
                )}
              </AlertDescription>
            </Alert>

            {/* Filters row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Departemen</Label>
                <Select value={departmentFilter} onValueChange={(v) => { setDepartmentFilter(v); setJabatanFilter("all"); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Departemen</SelectItem>
                    {departmentOptions.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Jabatan</Label>
                <Select value={jabatanFilter} onValueChange={setJabatanFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Jabatan</SelectItem>
                    {jabatanOptions.map(j => <SelectItem key={j} value={j}>{j}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="relative">
                <Label className="text-xs">Cari</Label>
                <Search className="absolute left-2 top-[30px] h-4 w-4 text-muted-foreground" />
                <Input placeholder="Nama / NIK..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Total Karyawan</p>
                <p className="text-xl font-bold">{rows.length}</p>
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

            {/* Toggle per-bulan saat Setahun Penuh */}
            {isYearView && (
              <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Tampilkan Rincian Per Bulan</p>
                    <p className="text-xs text-muted-foreground">
                      Aktifkan untuk melihat (dan ikut export) rekap iuran per periode bulan dalam setahun.
                    </p>
                  </div>
                </div>
                <Switch checked={showMonthly} onCheckedChange={setShowMonthly} />
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : rows.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                Tidak ada data BPJS untuk filter ini. Pastikan payroll periode terkait sudah difinalisasi.
              </div>
            ) : (
              <>
                {/* Per-month breakdown table */}
                {showMonthlyView && monthlyAggregate.length > 0 && (
                  <div className="rounded-md border overflow-x-auto">
                    <div className="px-3 py-2 text-sm font-semibold bg-muted/50">Rincian Per Bulan — {selectedYear}</div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Bulan</TableHead>
                          <TableHead className="text-center">Karyawan</TableHead>
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
                        {monthlyAggregate.map(mo => {
                          const empT = mo.bpjs_kesehatan + mo.bpjs_ketenagakerjaan;
                          const erT = mo.bpjs_kes_employer + mo.bpjs_jht_employer + mo.bpjs_jp_employer + mo.bpjs_jkk_employer + mo.bpjs_jkm_employer;
                          return (
                            <TableRow key={mo.month}>
                              <TableCell className="font-medium">{MONTH_NAMES[mo.month - 1]}</TableCell>
                              <TableCell className="text-center text-xs">{mo.employees}</TableCell>
                              <TableCell className="text-right text-xs">{formatRupiah(mo.bpjs_kesehatan)}</TableCell>
                              <TableCell className="text-right text-xs">{formatRupiah(mo.bpjs_ketenagakerjaan)}</TableCell>
                              <TableCell className="text-right text-xs font-bold text-blue-600">{formatRupiah(empT)}</TableCell>
                              <TableCell className="text-right text-xs">{formatRupiah(mo.bpjs_kes_employer)}</TableCell>
                              <TableCell className="text-right text-xs">{formatRupiah(mo.bpjs_jht_employer)}</TableCell>
                              <TableCell className="text-right text-xs">{formatRupiah(mo.bpjs_jp_employer)}</TableCell>
                              <TableCell className="text-right text-xs">{formatRupiah(mo.bpjs_jkk_employer)}</TableCell>
                              <TableCell className="text-right text-xs">{formatRupiah(mo.bpjs_jkm_employer)}</TableCell>
                              <TableCell className="text-right text-xs font-bold text-emerald-600">{formatRupiah(erT)}</TableCell>
                              <TableCell className="text-right text-xs font-bold text-primary">{formatRupiah(empT + erT)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <div className="rounded-md border overflow-x-auto">
                  <div className="px-3 py-2 text-sm font-semibold bg-muted/50">Rekap Per Karyawan</div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nama</TableHead>
                        <TableHead>NIK</TableHead>
                        <TableHead>Jabatan</TableHead>
                        <TableHead>Dept</TableHead>
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
                      {rows.map(r => {
                        const empTot = r.bpjs_kesehatan + r.bpjs_ketenagakerjaan;
                        const erTot = r.bpjs_kes_employer + r.bpjs_jht_employer + r.bpjs_jp_employer + r.bpjs_jkk_employer + r.bpjs_jkm_employer;
                        return (
                          <TableRow key={r.user_id}>
                            <TableCell className="font-medium">{r.full_name}</TableCell>
                            <TableCell className="text-xs">{r.nik}</TableCell>
                            <TableCell className="text-xs">{r.jabatan}</TableCell>
                            <TableCell className="text-xs">{r.departemen}</TableCell>
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
                        <TableCell colSpan={4}>TOTAL</TableCell>
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
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default BPJSReport;
