import { useEffect, useState, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Receipt, FileText, Files } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { applyBusinessTravelAllowance } from "@/lib/businessTravelAllowance";
import {
  generateBusinessTravelVoucherPDF,
  generateBusinessTravelVoucherBatchPDF,
  type TravelVoucherData,
} from "@/lib/businessTravelVoucherPdfGenerator";
import logoSrc from "@/assets/logo.png";
import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  selectedMonth: number; // 1-12
  selectedYear: number;
}

interface Row {
  id: string;
  user_id: string;
  destination: string;
  purpose: string;
  start_date: string;
  end_date: string;
  total_days: number;
  full_name: string;
  nik: string;
  departemen: string | null;
  jabatan: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
}

const fmtIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n || 0);

interface TripCalc {
  amount: number;
  source: "manual" | "formula";
  effective_days: number;
  per_day_travel: number;
  per_day_attendance: number;
  splits: { period_month: number; period_year: number; days: number; amount: number }[];
}

const BusinessTravelVoucherExportDialog = ({ open, onOpenChange, selectedMonth, selectedYear }: Props) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [calcMap, setCalcMap] = useState<Record<string, TripCalc>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterMode, setFilterMode] = useState<"period" | "all">("period");
  const [generating, setGenerating] = useState<"single" | "batch" | "split" | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelectedIds(new Set());
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, filterMode, selectedMonth, selectedYear]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("business_travel_requests")
        .select("id, user_id, destination, purpose, start_date, end_date, total_days")
        .eq("status", "approved")
        .order("start_date", { ascending: false });

      if (filterMode === "period") {
        // Cut-off 21–20: tampilkan trip yang start_date dalam window
        const start = `${selectedYear}-${String(selectedMonth - 1 || 12).padStart(2, "0")}-21`;
        const startYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
        const startStr = `${startYear}-${String(selectedMonth === 1 ? 12 : selectedMonth - 1).padStart(2, "0")}-21`;
        const endStr = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-20`;
        query = query.gte("start_date", startStr).lte("start_date", endStr);
        void start;
      }

      const { data: trips, error } = await query;
      if (error) throw error;
      const list = trips || [];
      if (list.length === 0) {
        setRows([]);
        return;
      }
      const userIds = Array.from(new Set(list.map((t) => t.user_id)));
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, nik, departemen, jabatan, bank_name, bank_account_number")
        .in("id", userIds);
      const pmap = new Map((profs || []).map((p: any) => [p.id, p]));
      const enriched: Row[] = list.map((t: any) => {
        const p: any = pmap.get(t.user_id) || {};
        return {
          id: t.id,
          user_id: t.user_id,
          destination: t.destination,
          purpose: t.purpose,
          start_date: t.start_date,
          end_date: t.end_date,
          total_days: t.total_days,
          full_name: p.full_name || "-",
          nik: p.nik || "-",
          departemen: p.departemen,
          jabatan: p.jabatan,
          bank_name: p.bank_name,
          bank_account_number: p.bank_account_number,
        };
      });
      setRows(enriched);
      await computeAmounts(enriched, userIds);
    } catch (e: any) {
      toast({ title: "Gagal memuat", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Nominal voucher mengikuti nilai yang benar-benar tercatat di payroll
   * (payroll_overrides.tunjangan_perjalanan_dinas — termasuk input manual admin).
   * Jika ada beberapa trip dalam 1 periode, nilai tercatat dibagi pro-rata
   * berdasarkan hari dinas efektif tiap trip. Bila tidak ada nilai tercatat,
   * jatuh kembali ke hasil formula (per_day × hari efektif).
   */
  const computeAmounts = async (list: Row[], userIds: string[]) => {
    try {
      // Semua trip approved milik karyawan terkait (untuk pro-rata per periode)
      const { data: allTrips } = await supabase
        .from("business_travel_requests")
        .select("id, user_id, start_date, end_date")
        .eq("status", "approved")
        .in("user_id", userIds);

      const tripCalcs = new Map<string, Awaited<ReturnType<typeof applyBusinessTravelAllowance>>>();
      const daysByUserPeriod = new Map<string, number>();
      for (const t of allTrips || []) {
        const res = await applyBusinessTravelAllowance({
          userId: t.user_id,
          startDate: t.start_date,
          endDate: t.end_date,
          dryRun: true,
        });
        tripCalcs.set(t.id, res);
        for (const s of res.splits || []) {
          const k = `${t.user_id}-${s.period_year}-${s.period_month}`;
          daysByUserPeriod.set(k, (daysByUserPeriod.get(k) || 0) + s.days);
        }
      }

      const { data: overrides } = await supabase
        .from("payroll_overrides")
        .select("user_id, period_month, period_year, tunjangan_perjalanan_dinas")
        .in("user_id", userIds);
      const recorded = new Map<string, number>();
      for (const o of (overrides || []) as any[]) {
        const v = Number(o.tunjangan_perjalanan_dinas) || 0;
        if (v > 0) recorded.set(`${o.user_id}-${o.period_year}-${o.period_month}`, v);
      }

      const map: Record<string, TripCalc> = {};
      for (const r of list) {
        const calc = tripCalcs.get(r.id);
        if (!calc || !calc.ok) continue;
        let manual = false;
        const splits = (calc.splits || []).map((s) => {
          const k = `${r.user_id}-${s.period_year}-${s.period_month}`;
          const rec = recorded.get(k);
          if (!rec) return { ...s };
          const totalDays = daysByUserPeriod.get(k) || s.days;
          const alloc = Math.round((rec * s.days) / (totalDays || 1));
          if (alloc !== s.amount) manual = true;
          return { ...s, amount: alloc };
        });
        map[r.id] = {
          amount: splits.reduce((a, s) => a + s.amount, 0),
          source: manual ? "manual" : "formula",
          effective_days: calc.travel_days_effective,
          per_day_travel: calc.per_day_travel,
          per_day_attendance: calc.per_day_attendance,
          splits: splits.map((s) => ({ period_month: s.period_month, period_year: s.period_year, days: s.days, amount: s.amount })),
        };
      }
      setCalcMap(map);
    } catch (e) {
      console.error("computeAmounts failed", e);
    }
  };

  const allSelected = rows.length > 0 && selectedIds.size === rows.length;
  const toggle = (id: string) => {
    const n = new Set(selectedIds);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelectedIds(n);
  };
  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(rows.map((r) => r.id)));
  };

  const selectedRows = useMemo(() => rows.filter((r) => selectedIds.has(r.id)), [rows, selectedIds]);

  const buildVoucherData = async (r: Row): Promise<TravelVoucherData | null> => {
    const calc = calcMap[r.id];
    if (!calc || calc.amount <= 0) return null;
    return {
      voucher_no: `PD-${r.id.slice(0, 8).toUpperCase()}`,
      issued_at: new Date(),
      employee_name: r.full_name,
      nik: r.nik,
      jabatan: r.jabatan || "-",
      departemen: r.departemen || "-",
      bank_name: r.bank_name || "-",
      bank_account_number: r.bank_account_number || "-",
      destination: r.destination,
      purpose: r.purpose,
      start_date: r.start_date,
      end_date: r.end_date,
      total_days: r.total_days,
      effective_days: calc.effective_days,
      per_day_travel: calc.source === "manual" && calc.effective_days > 0
        ? Math.round(calc.amount / calc.effective_days)
        : calc.per_day_travel,
      per_day_attendance_deduction: calc.per_day_attendance,
      total_amount: calc.amount,
      splits: calc.splits.filter((s) => s.amount > 0),
    };
  };


  const handleMerged = async () => {
    if (selectedRows.length === 0) {
      toast({ title: "Pilih minimal 1 karyawan", variant: "destructive" });
      return;
    }
    setGenerating("batch");
    try {
      const items: TravelVoucherData[] = [];
      const skipped: string[] = [];
      for (const r of selectedRows) {
        const v = await buildVoucherData(r);
        if (v) items.push(v); else skipped.push(r.full_name);
      }
      if (items.length === 0) {
        toast({ title: "Tidak ada nominal tunjangan", description: "Semua karyawan terpilih tidak menghasilkan nominal tunjangan.", variant: "destructive" });
        return;
      }
      await generateBusinessTravelVoucherBatchPDF(items, logoSrc);
      toast({
        title: "Voucher gabungan diunduh",
        description: `${items.length} karyawan${skipped.length ? `, ${skipped.length} dilewati (nominal 0)` : ""}.`,
      });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Gagal", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(null);
    }
  };

  const handleSplit = async () => {
    if (selectedRows.length === 0) {
      toast({ title: "Pilih minimal 1 karyawan", variant: "destructive" });
      return;
    }
    setGenerating("split");
    try {
      let count = 0;
      for (const r of selectedRows) {
        const v = await buildVoucherData(r);
        if (!v) continue;
        await generateBusinessTravelVoucherPDF(v, logoSrc);
        count += 1;
      }
      toast({ title: "Voucher per karyawan diunduh", description: `${count} file PDF.` });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Gagal", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" /> Voucher Transfer Perjalanan Dinas</DialogTitle>
          <DialogDescription>
            Pilih karyawan yang akan diterbitkan voucher transfer tunjangan perjalanan dinasnya. Bisa per karyawan atau digabung dalam 1 dokumen.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Filter:</span>
          <Button size="sm" variant={filterMode === "period" ? "default" : "outline"} onClick={() => setFilterMode("period")}>
            Periode Payroll Aktif
          </Button>
          <Button size="sm" variant={filterMode === "all" ? "default" : "outline"} onClick={() => setFilterMode("all")}>
            Semua Approved
          </Button>
        </div>

        <div className="border rounded-md max-h-[420px] overflow-auto">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin mr-2" />Memuat...</div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Tidak ada perjalanan dinas approved untuk filter ini.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="p-2 w-10"><Checkbox checked={allSelected} onCheckedChange={toggleAll} /></th>
                  <th className="p-2 text-left">Karyawan</th>
                  <th className="p-2 text-left">Tujuan</th>
                  <th className="p-2 text-left">Tanggal</th>
                  <th className="p-2 text-right">Hari</th>
                  <th className="p-2 text-right">Nominal Voucher</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-muted/40 cursor-pointer" onClick={() => toggle(r.id)}>
                    <td className="p-2"><Checkbox checked={selectedIds.has(r.id)} onCheckedChange={() => toggle(r.id)} /></td>
                    <td className="p-2">
                      <div className="font-medium">{r.full_name}</div>
                      <div className="text-xs text-muted-foreground">{r.nik} · {r.departemen || "-"}</div>
                    </td>
                    <td className="p-2">{r.destination}</td>
                    <td className="p-2 text-xs">
                      {format(parseISO(r.start_date), "dd MMM yyyy", { locale: idLocale })}<br />
                      <span className="text-muted-foreground">s/d {format(parseISO(r.end_date), "dd MMM yyyy", { locale: idLocale })}</span>
                    </td>
                    <td className="p-2 text-right">{r.total_days}</td>
                    <td className="p-2 text-right whitespace-nowrap">
                      {calcMap[r.id] ? (
                        <>
                          <div className="font-medium">{fmtIDR(calcMap[r.id].amount)}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {calcMap[r.id].source === "manual" ? "input manual payroll" : `${calcMap[r.id].effective_days} hari × ${fmtIDR(calcMap[r.id].per_day_travel)}`}
                          </div>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between text-sm">
          <Badge variant="secondary">{selectedIds.size} dipilih dari {rows.length}</Badge>
        </div>

        <DialogFooter className="gap-2 flex-col sm:flex-row">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={!!generating}>Batal</Button>
          <Button variant="outline" onClick={handleSplit} disabled={!!generating || selectedIds.size === 0} className="gap-2">
            {generating === "split" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Files className="h-4 w-4" />}
            PDF Per Karyawan ({selectedIds.size})
          </Button>
          <Button onClick={handleMerged} disabled={!!generating || selectedIds.size === 0} className="gap-2">
            {generating === "batch" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Gabung 1 Dokumen ({selectedIds.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BusinessTravelVoucherExportDialog;
