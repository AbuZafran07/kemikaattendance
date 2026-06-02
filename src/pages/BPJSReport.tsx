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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [activeTab, setActiveTab] = useState<"kesehatan" | "ketenagakerjaan">("kesehatan");
  const [items, setItems] = useState<RawItem[]>([]);
  const [profiles, setProfiles] = useState<Map<string, ProfileInfo>>(new Map());
  const [bpjsBase, setBpjsBase] = useState<"basic" | "basic_plus_fixed">("basic");
  const [baseEffectiveDate, setBaseEffectiveDate] = useState<string | null>(null);
  const [bpjsFixedComponents, setBpjsFixedComponents] = useState<{ jabatan: boolean; komunikasi: boolean; operasional: boolean }>({ jabatan: true, komunikasi: true, operasional: true });
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
    const fac = cfg.fixed_allowance_components || {};
    setBpjsFixedComponents({
      jabatan: fac.jabatan !== false,
      komunikasi: fac.komunikasi !== false,
      operasional: fac.operasional !== false,
    });
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

  // Aggregated per-employee rows
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

  // Aggregated per-month
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

  // Tab-specific totals
  const kesTotals = useMemo(() => {
    const emp = rows.reduce((s, r) => s + r.bpjs_kesehatan, 0);
    const er = rows.reduce((s, r) => s + r.bpjs_kes_employer, 0);
    return { emp, er, grand: emp + er };
  }, [rows]);

  const ktTotals = useMemo(() => {
    const emp = rows.reduce((s, r) => s + r.bpjs_ketenagakerjaan, 0);
    const er = rows.reduce((s, r) => s + r.bpjs_jht_employer + r.bpjs_jp_employer + r.bpjs_jkk_employer + r.bpjs_jkm_employer, 0);
    return { emp, er, grand: emp + er };
  }, [rows]);

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
    info.addRow([`LAPORAN BPJS ${activeTab === "kesehatan" ? "KESEHATAN" : "KETENAGAKERJAAN"}`]).font = { bold: true, size: 14 };
    info.addRow(["Periode", periodLabel]);
    info.addRow(["Departemen", departmentFilter === "all" ? "Semua" : departmentFilter]);
    info.addRow(["Jabatan", jabatanFilter === "all" ? "Semua" : jabatanFilter]);
    info.addRow(["Dasar Perhitungan BPJS", baseLabel]);
    info.addRow(["Berlaku Efektif Sejak", baseDateLabel]);
    info.addRow(["Dicetak", new Date().toLocaleString("id-ID")]);
    info.getColumn(1).width = 28; info.getColumn(2).width = 40;

    if (activeTab === "kesehatan") {
      const ws = wb.addWorksheet("BPJS Kesehatan");
      const headers = ["No", "Nama", "NIK", "Jabatan", "Departemen", "Iuran Karyawan", "Iuran Perusahaan", "Grand Total"];
      ws.addRow(headers);
      ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF008751" } };

      rows.forEach((r, i) => {
        ws.addRow([i + 1, r.full_name, r.nik, r.jabatan, r.departemen, r.bpjs_kesehatan, r.bpjs_kes_employer, r.bpjs_kesehatan + r.bpjs_kes_employer]);
      });

      const totalRow = ws.addRow(["", "TOTAL", "", "", "", kesTotals.emp, kesTotals.er, kesTotals.grand]);
      totalRow.font = { bold: true };
      totalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F0F0" } };

      [6, 7, 8].forEach(c => { ws.getColumn(c).numFmt = '#,##0'; ws.getColumn(c).width = 20; });
      ws.getColumn(1).width = 5; ws.getColumn(2).width = 28; ws.getColumn(3).width = 14;
      ws.getColumn(4).width = 22; ws.getColumn(5).width = 22;

      if (isYearView && monthlyAggregate.length > 0) {
        const wm = wb.addWorksheet("Rekap Per Bulan");
        const mh = ["Bulan", "Jumlah Karyawan", "Iuran Karyawan", "Iuran Perusahaan", "Grand Total"];
        wm.addRow(mh);
        wm.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
        wm.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF008751" } };
        monthlyAggregate.forEach(mo => {
          wm.addRow([MONTH_NAMES[mo.month - 1], mo.employees, mo.bpjs_kesehatan, mo.bpjs_kes_employer, mo.bpjs_kesehatan + mo.bpjs_kes_employer]);
        });
        const tr = wm.addRow([
          "TOTAL", "",
          monthlyAggregate.reduce((s, m) => s + m.bpjs_kesehatan, 0),
          monthlyAggregate.reduce((s, m) => s + m.bpjs_kes_employer, 0),
          monthlyAggregate.reduce((s, m) => s + m.bpjs_kesehatan + m.bpjs_kes_employer, 0),
        ]);
        tr.font = { bold: true };
        tr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F0F0" } };
        [3, 4, 5].forEach(c => { wm.getColumn(c).numFmt = '#,##0'; wm.getColumn(c).width = 20; });
        wm.getColumn(1).width = 14; wm.getColumn(2).width = 16;
      }
    } else {
      const ws = wb.addWorksheet("BPJS Ketenagakerjaan");
      const headers = ["No", "Nama", "NIK", "Jabatan", "Departemen", "Iuran Karyawan (JHT+JP)", "JHT Perusahaan", "JP Perusahaan", "JKK Perusahaan", "JKM Perusahaan", "Total Perusahaan", "Grand Total"];
      ws.addRow(headers);
      ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF008751" } };

      rows.forEach((r, i) => {
        const erTot = r.bpjs_jht_employer + r.bpjs_jp_employer + r.bpjs_jkk_employer + r.bpjs_jkm_employer;
        ws.addRow([i + 1, r.full_name, r.nik, r.jabatan, r.departemen, r.bpjs_ketenagakerjaan, r.bpjs_jht_employer, r.bpjs_jp_employer, r.bpjs_jkk_employer, r.bpjs_jkm_employer, erTot, r.bpjs_ketenagakerjaan + erTot]);
      });

      const totalRow = ws.addRow(["", "TOTAL", "", "", "", ktTotals.emp, rows.reduce((s, r) => s + r.bpjs_jht_employer, 0), rows.reduce((s, r) => s + r.bpjs_jp_employer, 0), rows.reduce((s, r) => s + r.bpjs_jkk_employer, 0), rows.reduce((s, r) => s + r.bpjs_jkm_employer, 0), ktTotals.er, ktTotals.grand]);
      totalRow.font = { bold: true };
      totalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F0F0" } };

      [6, 7, 8, 9, 10, 11, 12].forEach(c => { ws.getColumn(c).numFmt = '#,##0'; ws.getColumn(c).width = 20; });
      ws.getColumn(1).width = 5; ws.getColumn(2).width = 28; ws.getColumn(3).width = 14;
      ws.getColumn(4).width = 22; ws.getColumn(5).width = 22;

      if (isYearView && monthlyAggregate.length > 0) {
        const wm = wb.addWorksheet("Rekap Per Bulan");
        const mh = ["Bulan", "Jumlah Karyawan", "Iuran Karyawan (JHT+JP)", "JHT Perusahaan", "JP Perusahaan", "JKK Perusahaan", "JKM Perusahaan", "Total Perusahaan", "Grand Total"];
        wm.addRow(mh);
        wm.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
        wm.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF008751" } };
        monthlyAggregate.forEach(mo => {
          const erT = mo.bpjs_jht_employer + mo.bpjs_jp_employer + mo.bpjs_jkk_employer + mo.bpjs_jkm_employer;
          wm.addRow([MONTH_NAMES[mo.month - 1], mo.employees, mo.bpjs_ketenagakerjaan, mo.bpjs_jht_employer, mo.bpjs_jp_employer, mo.bpjs_jkk_employer, mo.bpjs_jkm_employer, erT, mo.bpjs_ketenagakerjaan + erT]);
        });
        const tr = wm.addRow([
          "TOTAL", "",
          monthlyAggregate.reduce((s, m) => s + m.bpjs_ketenagakerjaan, 0),
          monthlyAggregate.reduce((s, m) => s + m.bpjs_jht_employer, 0),
          monthlyAggregate.reduce((s, m) => s + m.bpjs_jp_employer, 0),
          monthlyAggregate.reduce((s, m) => s + m.bpjs_jkk_employer, 0),
          monthlyAggregate.reduce((s, m) => s + m.bpjs_jkm_employer, 0),
          monthlyAggregate.reduce((s, m) => s + m.bpjs_jht_employer + m.bpjs_jp_employer + m.bpjs_jkk_employer + m.bpjs_jkm_employer, 0),
          monthlyAggregate.reduce((s, m) => s + m.bpjs_ketenagakerjaan + m.bpjs_jht_employer + m.bpjs_jp_employer + m.bpjs_jkk_employer + m.bpjs_jkm_employer, 0),
        ]);
        tr.font = { bold: true };
        tr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F0F0" } };
        [3, 4, 5, 6, 7, 8, 9].forEach(c => { wm.getColumn(c).numFmt = '#,##0'; wm.getColumn(c).width = 20; });
        wm.getColumn(1).width = 14; wm.getColumn(2).width = 16;
      }
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `Laporan_BPJS_${activeTab === "kesehatan" ? "Kesehatan" : "Ketenagakerjaan"}_${fileSuffix}.xlsx`;
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
    doc.text(`LAPORAN BPJS ${activeTab === "kesehatan" ? "KESEHATAN" : "KETENAGAKERJAAN"}`, mx + 20, 14);
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(`Periode: ${periodLabel}${filterChip()} | PT. Kemika Karya Pratama`, mx + 20, 20);
    doc.setFontSize(8);
    doc.text(`Dasar Perhitungan BPJS: ${baseLabel}  |  Berlaku efektif sejak: ${baseDateLabel}`, mx + 20, 24.5);
    doc.setDrawColor(0, 135, 81); doc.setLineWidth(0.8);
    doc.line(mx, 28, pw - mx, 28);

    let y = 34;
    const isKes = activeTab === "kesehatan";
    const cards = [
      { label: "Total Karyawan", value: String(rows.length) },
      { label: "Iuran Karyawan", value: formatRupiah(isKes ? kesTotals.emp : ktTotals.emp) },
      { label: "Iuran Perusahaan", value: formatRupiah(isKes ? kesTotals.er : ktTotals.er) },
      { label: "Grand Total", value: formatRupiah(isKes ? kesTotals.grand : ktTotals.grand) },
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

    if (isKes) {
      autoTable(doc, {
        startY: y,
        head: [["No", "Nama", "NIK", "Jabatan", "Dept", "Kes (Kary)", "Kes (Per)", "Grand Total"]],
        body: rows.map((r, i) => [
          i + 1, r.full_name, r.nik, r.jabatan, r.departemen,
          formatRupiah(r.bpjs_kesehatan), formatRupiah(r.bpjs_kes_employer),
          formatRupiah(r.bpjs_kesehatan + r.bpjs_kes_employer),
        ]),
        margin: { left: mx, right: mx },
        styles: { fontSize: 7, cellPadding: 1.6 },
        headStyles: { fillColor: [0, 135, 81], textColor: 255, fontStyle: "bold", fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 8, halign: "center" },
          5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right", fontStyle: "bold" },
        },
        foot: [["", "TOTAL", "", "", "", formatRupiah(kesTotals.emp), formatRupiah(kesTotals.er), formatRupiah(kesTotals.grand)]],
        footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: "bold", fontSize: 7 },
      });
    } else {
      autoTable(doc, {
        startY: y,
        head: [["No", "Nama", "NIK", "Jabatan", "Dept", "JHT+JP (Kary)", "JHT (Per)", "JP (Per)", "JKK (Per)", "JKM (Per)", "Tot Per", "Grand Total"]],
        body: rows.map((r, i) => {
          const erTot = r.bpjs_jht_employer + r.bpjs_jp_employer + r.bpjs_jkk_employer + r.bpjs_jkm_employer;
          return [
            i + 1, r.full_name, r.nik, r.jabatan, r.departemen,
            formatRupiah(r.bpjs_ketenagakerjaan), formatRupiah(r.bpjs_jht_employer), formatRupiah(r.bpjs_jp_employer),
            formatRupiah(r.bpjs_jkk_employer), formatRupiah(r.bpjs_jkm_employer), formatRupiah(erTot),
            formatRupiah(r.bpjs_ketenagakerjaan + erTot),
          ];
        }),
        margin: { left: mx, right: mx },
        styles: { fontSize: 6, cellPadding: 1.4 },
        headStyles: { fillColor: [0, 135, 81], textColor: 255, fontStyle: "bold", fontSize: 6 },
        columnStyles: {
          0: { cellWidth: 7, halign: "center" },
          5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" },
          8: { halign: "right" }, 9: { halign: "right" }, 10: { halign: "right", fontStyle: "bold" },
          11: { halign: "right", fontStyle: "bold" },
        },
        foot: [[
          "", "TOTAL", "", "", "",
          formatRupiah(ktTotals.emp),
          formatRupiah(rows.reduce((s, r) => s + r.bpjs_jht_employer, 0)),
          formatRupiah(rows.reduce((s, r) => s + r.bpjs_jp_employer, 0)),
          formatRupiah(rows.reduce((s, r) => s + r.bpjs_jkk_employer, 0)),
          formatRupiah(rows.reduce((s, r) => s + r.bpjs_jkm_employer, 0)),
          formatRupiah(ktTotals.er),
          formatRupiah(ktTotals.grand),
        ]],
        footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: "bold", fontSize: 6 },
      });
    }

    // Per-month section
    if (isYearView && monthlyAggregate.length > 0) {
      const lastY = (doc as any).lastAutoTable?.finalY || y + 60;
      doc.addPage();
      doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(0);
      doc.text(`Rincian Iuran BPJS ${isKes ? "Kesehatan" : "Ketenagakerjaan"} Per Bulan — ${selectedYear}`, mx, 14);
      doc.setDrawColor(0, 135, 81); doc.setLineWidth(0.6);
      doc.line(mx, 17, pw - mx, 17);

      if (isKes) {
        autoTable(doc, {
          startY: 22,
          head: [["Bulan", "Karyawan", "Kes (Kary)", "Kes (Per)", "Grand Total"]],
          body: monthlyAggregate.map(mo => [
            MONTH_NAMES[mo.month - 1], mo.employees,
            formatRupiah(mo.bpjs_kesehatan), formatRupiah(mo.bpjs_kes_employer),
            formatRupiah(mo.bpjs_kesehatan + mo.bpjs_kes_employer),
          ]),
          margin: { left: mx, right: mx },
          styles: { fontSize: 7, cellPadding: 1.6 },
          headStyles: { fillColor: [0, 135, 81], textColor: 255, fontStyle: "bold", fontSize: 7 },
          columnStyles: {
            0: { cellWidth: 22 }, 1: { halign: "center", cellWidth: 18 },
            2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right", fontStyle: "bold" },
          },
        });
      } else {
        autoTable(doc, {
          startY: 22,
          head: [["Bulan", "Karyawan", "JHT+JP (Kary)", "JHT (Per)", "JP (Per)", "JKK (Per)", "JKM (Per)", "Tot Per", "Grand Total"]],
          body: monthlyAggregate.map(mo => {
            const erT = mo.bpjs_jht_employer + mo.bpjs_jp_employer + mo.bpjs_jkk_employer + mo.bpjs_jkm_employer;
            return [
              MONTH_NAMES[mo.month - 1], mo.employees,
              formatRupiah(mo.bpjs_ketenagakerjaan), formatRupiah(mo.bpjs_jht_employer), formatRupiah(mo.bpjs_jp_employer),
              formatRupiah(mo.bpjs_jkk_employer), formatRupiah(mo.bpjs_jkm_employer), formatRupiah(erT),
              formatRupiah(mo.bpjs_ketenagakerjaan + erT),
            ];
          }),
          margin: { left: mx, right: mx },
          styles: { fontSize: 7, cellPadding: 1.6 },
          headStyles: { fillColor: [0, 135, 81], textColor: 255, fontStyle: "bold", fontSize: 7 },
          columnStyles: {
            0: { cellWidth: 22 }, 1: { halign: "center", cellWidth: 18 },
            2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" },
            5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right", fontStyle: "bold" },
            8: { halign: "right", fontStyle: "bold" },
          },
        });
      }
    }

    const fy = (doc as any).lastAutoTable?.finalY || y + 60;
    doc.setFontSize(7); doc.setTextColor(128); doc.setFont("helvetica", "normal");
    doc.text(`Dicetak pada: ${new Date().toLocaleString("id-ID")}`, mx, Math.min(fy + 10, ph - 8));
    doc.text("Dokumen ini digenerate otomatis oleh sistem.", pw - mx, Math.min(fy + 10, ph - 8), { align: "right" });

    doc.save(`Laporan_BPJS_${isKes ? "Kesehatan" : "Ketenagakerjaan"}_${fileSuffix}.pdf`);
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

            {/* Tab switcher */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "kesehatan" | "ketenagakerjaan")}>
              <TabsList className="w-full sm:w-auto">
                <TabsTrigger value="kesehatan" className="flex-1 sm:flex-none">BPJS Kesehatan</TabsTrigger>
                <TabsTrigger value="ketenagakerjaan" className="flex-1 sm:flex-none">BPJS Ketenagakerjaan</TabsTrigger>
              </TabsList>
            </Tabs>

            {activeTab === "kesehatan" ? (
              <>
                {/* Summary cards Kesehatan */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Total Karyawan</p>
                    <p className="text-xl font-bold">{rows.length}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Iuran Karyawan</p>
                    <p className="text-lg font-bold text-blue-600">{formatRupiah(kesTotals.emp)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Iuran Perusahaan</p>
                    <p className="text-lg font-bold text-emerald-600">{formatRupiah(kesTotals.er)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Grand Total</p>
                    <p className="text-lg font-bold text-primary">{formatRupiah(kesTotals.grand)}</p>
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
                    Tidak ada data BPJS Kesehatan untuk filter ini. Pastikan payroll periode terkait sudah difinalisasi.
                  </div>
                ) : (
                  <>
                    {/* Per-month breakdown Kesehatan */}
                    {showMonthlyView && monthlyAggregate.length > 0 && (
                      <div className="rounded-md border overflow-x-auto">
                        <div className="px-3 py-2 text-sm font-semibold bg-muted/50">Rincian BPJS Kesehatan Per Bulan — {selectedYear}</div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Bulan</TableHead>
                              <TableHead className="text-center">Karyawan</TableHead>
                              <TableHead className="text-right">Iuran Karyawan</TableHead>
                              <TableHead className="text-right">Iuran Perusahaan</TableHead>
                              <TableHead className="text-right font-bold">Grand Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {monthlyAggregate.map(mo => (
                              <TableRow key={mo.month}>
                                <TableCell className="font-medium">{MONTH_NAMES[mo.month - 1]}</TableCell>
                                <TableCell className="text-center text-xs">{mo.employees}</TableCell>
                                <TableCell className="text-right text-xs">{formatRupiah(mo.bpjs_kesehatan)}</TableCell>
                                <TableCell className="text-right text-xs">{formatRupiah(mo.bpjs_kes_employer)}</TableCell>
                                <TableCell className="text-right text-xs font-bold text-primary">{formatRupiah(mo.bpjs_kesehatan + mo.bpjs_kes_employer)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    <div className="rounded-md border overflow-x-auto">
                      <div className="px-3 py-2 text-sm font-semibold bg-muted/50">Rekap BPJS Kesehatan Per Karyawan</div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nama</TableHead>
                            <TableHead>NIK</TableHead>
                            <TableHead>Jabatan</TableHead>
                            <TableHead>Dept</TableHead>
                            <TableHead className="text-right">Iuran Karyawan</TableHead>
                            <TableHead className="text-right">Iuran Perusahaan</TableHead>
                            <TableHead className="text-right font-bold">Grand Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.map(r => (
                            <TableRow key={r.user_id}>
                              <TableCell className="font-medium">{r.full_name}</TableCell>
                              <TableCell className="text-xs">{r.nik}</TableCell>
                              <TableCell className="text-xs">{r.jabatan}</TableCell>
                              <TableCell className="text-xs">{r.departemen}</TableCell>
                              <TableCell className="text-right text-xs">{formatRupiah(r.bpjs_kesehatan)}</TableCell>
                              <TableCell className="text-right text-xs">{formatRupiah(r.bpjs_kes_employer)}</TableCell>
                              <TableCell className="text-right text-xs font-bold text-primary">{formatRupiah(r.bpjs_kesehatan + r.bpjs_kes_employer)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-muted/50 font-bold">
                            <TableCell colSpan={4}>TOTAL</TableCell>
                            <TableCell className="text-right text-xs">{formatRupiah(kesTotals.emp)}</TableCell>
                            <TableCell className="text-right text-xs">{formatRupiah(kesTotals.er)}</TableCell>
                            <TableCell className="text-right text-xs text-primary">{formatRupiah(kesTotals.grand)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                {/* Summary cards Ketenagakerjaan */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Total Karyawan</p>
                    <p className="text-xl font-bold">{rows.length}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Iuran Karyawan (JHT+JP)</p>
                    <p className="text-lg font-bold text-blue-600">{formatRupiah(ktTotals.emp)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Iuran Perusahaan</p>
                    <p className="text-lg font-bold text-emerald-600">{formatRupiah(ktTotals.er)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Grand Total</p>
                    <p className="text-lg font-bold text-primary">{formatRupiah(ktTotals.grand)}</p>
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
                    Tidak ada data BPJS Ketenagakerjaan untuk filter ini. Pastikan payroll periode terkait sudah difinalisasi.
                  </div>
                ) : (
                  <>
                    {/* Per-month breakdown Ketenagakerjaan */}
                    {showMonthlyView && monthlyAggregate.length > 0 && (
                      <div className="rounded-md border overflow-x-auto">
                        <div className="px-3 py-2 text-sm font-semibold bg-muted/50">Rincian BPJS Ketenagakerjaan Per Bulan — {selectedYear}</div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Bulan</TableHead>
                              <TableHead className="text-center">Karyawan</TableHead>
                              <TableHead className="text-right">JHT+JP (Kary)</TableHead>
                              <TableHead className="text-right">JHT (Per)</TableHead>
                              <TableHead className="text-right">JP (Per)</TableHead>
                              <TableHead className="text-right">JKK (Per)</TableHead>
                              <TableHead className="text-right">JKM (Per)</TableHead>
                              <TableHead className="text-right font-bold">Tot Perusahaan</TableHead>
                              <TableHead className="text-right font-bold">Grand Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {monthlyAggregate.map(mo => {
                              const erT = mo.bpjs_jht_employer + mo.bpjs_jp_employer + mo.bpjs_jkk_employer + mo.bpjs_jkm_employer;
                              return (
                                <TableRow key={mo.month}>
                                  <TableCell className="font-medium">{MONTH_NAMES[mo.month - 1]}</TableCell>
                                  <TableCell className="text-center text-xs">{mo.employees}</TableCell>
                                  <TableCell className="text-right text-xs">{formatRupiah(mo.bpjs_ketenagakerjaan)}</TableCell>
                                  <TableCell className="text-right text-xs">{formatRupiah(mo.bpjs_jht_employer)}</TableCell>
                                  <TableCell className="text-right text-xs">{formatRupiah(mo.bpjs_jp_employer)}</TableCell>
                                  <TableCell className="text-right text-xs">{formatRupiah(mo.bpjs_jkk_employer)}</TableCell>
                                  <TableCell className="text-right text-xs">{formatRupiah(mo.bpjs_jkm_employer)}</TableCell>
                                  <TableCell className="text-right text-xs font-bold text-emerald-600">{formatRupiah(erT)}</TableCell>
                                  <TableCell className="text-right text-xs font-bold text-primary">{formatRupiah(mo.bpjs_ketenagakerjaan + erT)}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    <div className="rounded-md border overflow-x-auto">
                      <div className="px-3 py-2 text-sm font-semibold bg-muted/50">Rekap BPJS Ketenagakerjaan Per Karyawan</div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nama</TableHead>
                            <TableHead>NIK</TableHead>
                            <TableHead>Jabatan</TableHead>
                            <TableHead>Dept</TableHead>
                            <TableHead className="text-right">JHT+JP (Kary)</TableHead>
                            <TableHead className="text-right">JHT (Per)</TableHead>
                            <TableHead className="text-right">JP (Per)</TableHead>
                            <TableHead className="text-right">JKK (Per)</TableHead>
                            <TableHead className="text-right">JKM (Per)</TableHead>
                            <TableHead className="text-right font-bold">Tot Perusahaan</TableHead>
                            <TableHead className="text-right font-bold">Grand Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.map(r => {
                            const erTot = r.bpjs_jht_employer + r.bpjs_jp_employer + r.bpjs_jkk_employer + r.bpjs_jkm_employer;
                            return (
                              <TableRow key={r.user_id}>
                                <TableCell className="font-medium">{r.full_name}</TableCell>
                                <TableCell className="text-xs">{r.nik}</TableCell>
                                <TableCell className="text-xs">{r.jabatan}</TableCell>
                                <TableCell className="text-xs">{r.departemen}</TableCell>
                                <TableCell className="text-right text-xs">{formatRupiah(r.bpjs_ketenagakerjaan)}</TableCell>
                                <TableCell className="text-right text-xs">{formatRupiah(r.bpjs_jht_employer)}</TableCell>
                                <TableCell className="text-right text-xs">{formatRupiah(r.bpjs_jp_employer)}</TableCell>
                                <TableCell className="text-right text-xs">{formatRupiah(r.bpjs_jkk_employer)}</TableCell>
                                <TableCell className="text-right text-xs">{formatRupiah(r.bpjs_jkm_employer)}</TableCell>
                                <TableCell className="text-right text-xs font-bold text-emerald-600">{formatRupiah(erTot)}</TableCell>
                                <TableCell className="text-right text-xs font-bold text-primary">{formatRupiah(r.bpjs_ketenagakerjaan + erTot)}</TableCell>
                              </TableRow>
                            );
                          })}
                          <TableRow className="bg-muted/50 font-bold">
                            <TableCell colSpan={4}>TOTAL</TableCell>
                            <TableCell className="text-right text-xs">{formatRupiah(ktTotals.emp)}</TableCell>
                            <TableCell className="text-right text-xs">{formatRupiah(rows.reduce((s, r) => s + r.bpjs_jht_employer, 0))}</TableCell>
                            <TableCell className="text-right text-xs">{formatRupiah(rows.reduce((s, r) => s + r.bpjs_jp_employer, 0))}</TableCell>
                            <TableCell className="text-right text-xs">{formatRupiah(rows.reduce((s, r) => s + r.bpjs_jkk_employer, 0))}</TableCell>
                            <TableCell className="text-right text-xs">{formatRupiah(rows.reduce((s, r) => s + r.bpjs_jkm_employer, 0))}</TableCell>
                            <TableCell className="text-right text-xs text-emerald-600">{formatRupiah(ktTotals.er)}</TableCell>
                            <TableCell className="text-right text-xs text-primary">{formatRupiah(ktTotals.grand)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default BPJSReport;
