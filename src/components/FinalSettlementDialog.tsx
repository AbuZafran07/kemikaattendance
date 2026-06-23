import { useEffect, useState, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Wallet, Info, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
const parseLocalDate = (s: string): Date => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
import { getCutoffPeriodBounds } from "@/lib/tenureCalculation";
import { format } from "date-fns";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: any | null;
}

const formatRp = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export const FinalSettlementDialog = ({ open, onOpenChange, employee }: Props) => {
  const { toast } = useToast();
  const [cutoffDay, setCutoffDay] = useState(21);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const resignDate = employee?.resign_date ? parseLocalDate(employee.resign_date) : null;

  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());

  // amounts (rupiah)
  const [sisaPeriodeAmount, setSisaPeriodeAmount] = useState<number>(0);
  const [sisaCutiDays, setSisaCutiDays] = useState<number>(0);
  const [sisaCutiAmount, setSisaCutiAmount] = useState<number>(0);
  const [pesangonAmount, setPesangonAmount] = useState<number>(0);
  const [loanPayoff, setLoanPayoff] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");

  // Period bounds
  const bounds = useMemo(() => getCutoffPeriodBounds(month, year, cutoffDay), [month, year, cutoffDay]);
  const basicSalary = Number(employee?.basic_salary) || 0;
  // Working days per month for daily-rate calc (consistent with system: 21)
  const dailyRate = basicSalary / 21;

  // Compute remaining cut-off days (resign+1 → period end)
  const remainingDays = useMemo(() => {
    if (!resignDate) return 0;
    const nextDay = new Date(resignDate.getTime() + 86400000);
    const start = nextDay > bounds.start ? nextDay : bounds.start;
    if (start > bounds.end) return 0;
    return Math.round((bounds.end.getTime() - start.getTime()) / 86400000) + 1;
  }, [resignDate, bounds]);

  // Default month/year from resign_date when dialog opens
  useEffect(() => {
    if (open && resignDate) {
      // Payroll period containing the resign date (using cutoff)
      const d = resignDate.getDate();
      const m = resignDate.getMonth() + 1;
      const y = resignDate.getFullYear();
      // If date >= cutoffDay → period is next month
      const periodMonth = d >= cutoffDay ? m + 1 : m;
      const periodYear = periodMonth > 12 ? y + 1 : y;
      setMonth(((periodMonth - 1) % 12) + 1);
      setYear(periodYear);
    }
  }, [open, employee?.id, cutoffDay]);

  // Load cutoff_day, profile.remaining_leave defaults & outstanding loans
  useEffect(() => {
    if (!open || !employee?.id) return;
    setLoading(true);
    (async () => {
      try {
        const [{ data: cutoffSetting }, { data: profile }, { data: loans }] = await Promise.all([
          supabase.from("system_settings").select("value").eq("key", "attendance_allowance").maybeSingle(),
          supabase.from("profiles").select("remaining_leave, basic_salary").eq("id", employee.id).maybeSingle(),
          supabase.from("employee_loans").select("remaining_amount, status").eq("user_id", employee.id).eq("status", "active"),
        ]);
        const cd = (cutoffSetting?.value as any)?.cutoff_day || 21;
        setCutoffDay(cd);
        const leaveLeft = profile?.remaining_leave ?? employee.remaining_leave ?? 0;
        setSisaCutiDays(Number(leaveLeft) || 0);
        const totalLoan = (loans || []).reduce((s: number, l: any) => s + (Number(l.remaining_amount) || 0), 0);
        setLoanPayoff(Math.round(totalLoan));
        setPesangonAmount(0);
        setNotes("");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, employee?.id]);

  // Auto-recompute amounts when inputs change
  useEffect(() => {
    setSisaPeriodeAmount(Math.max(0, Math.round(remainingDays * dailyRate)));
  }, [remainingDays, dailyRate]);

  useEffect(() => {
    setSisaCutiAmount(Math.max(0, Math.round((Number(sisaCutiDays) || 0) * dailyRate)));
  }, [sisaCutiDays, dailyRate]);

  const totalBonus = Math.max(0, (sisaPeriodeAmount || 0) + (sisaCutiAmount || 0) + (pesangonAmount || 0));
  const totalDeduction = Math.max(0, loanPayoff || 0);
  const netSettlement = totalBonus - totalDeduction;

  const handleSave = async () => {
    if (!employee?.id) return;
    if (!resignDate) {
      toast({ title: "Resign date belum diisi", description: "Edit profil & isi tanggal resign terlebih dahulu.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      // Build deduction_notes breakdown
      const breakdown: string[] = [
        `[Final Settlement ${MONTHS[month - 1]} ${year}]`,
        `Resign: ${format(resignDate, "dd MMM yyyy")}`,
        `Sisa periode ${remainingDays} hari: ${formatRp(sisaPeriodeAmount)}`,
        `Sisa cuti ${sisaCutiDays} hari: ${formatRp(sisaCutiAmount)}`,
        `Pesangon/uang pisah: ${formatRp(pesangonAmount)}`,
        `Pelunasan pinjaman: ${formatRp(loanPayoff)}`,
      ];
      if (notes.trim()) breakdown.push(`Catatan: ${notes.trim()}`);
      const mergedNotes = breakdown.join(" | ");

      // Check existing override → merge into bonus_lainnya/loan_deduction
      const { data: existing } = await supabase
        .from("payroll_overrides")
        .select("*")
        .eq("user_id", employee.id)
        .eq("period_month", month)
        .eq("period_year", year)
        .maybeSingle();

      const payload: any = {
        user_id: employee.id,
        period_month: month,
        period_year: year,
        bonus_lainnya: totalBonus,
        loan_deduction: totalDeduction,
        deduction_notes: mergedNotes,
      };

      if (existing?.id) {
        const { error } = await supabase.from("payroll_overrides").update(payload).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("payroll_overrides").insert(payload);
        if (error) throw error;
      }

      toast({
        title: "Final Settlement tersimpan",
        description: `Override payroll periode ${MONTHS[month - 1]} ${year} berhasil disimpan. Generate ulang payroll periode tsb untuk menerapkannya.`,
      });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Gagal menyimpan", description: e.message || String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!employee) return null;

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 + i);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" /> Final Settlement — {employee.full_name}
          </DialogTitle>
          <DialogDescription>
            Hitung & simpan otomatis ke <b>Payroll Override</b> untuk periode yang dipilih
            (sisa periode, sisa cuti, pesangon, dan pelunasan pinjaman).
          </DialogDescription>
        </DialogHeader>

        {!resignDate && (
          <Alert variant="destructive">
            <AlertDescription>
              Tanggal resign karyawan belum diisi. Silakan edit profil dan isi tanggal resign terlebih dahulu.
            </AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Period selector */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Periode Payroll — Bulan</Label>
                <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Tahun</Label>
                <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Periode cut-off: <b>{format(bounds.start, "dd MMM yyyy")}</b> – <b>{format(bounds.end, "dd MMM yyyy")}</b><br />
                Gapok: <b>{formatRp(basicSalary)}</b> · Tarif harian (÷21): <b>{formatRp(dailyRate)}</b><br />
                Resign: <b>{resignDate ? format(resignDate, "dd MMM yyyy") : "-"}</b> · Sisa periode setelah resign: <b>{remainingDays} hari</b>
              </AlertDescription>
            </Alert>

            <Separator />

            {/* Sisa Periode */}
            <div className="space-y-1">
              <Label>Sisa periode cut-off (dibayar di muka)</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input value={`${remainingDays} hari`} readOnly className="bg-muted" />
                <Input
                  type="number" min={0}
                  value={sisaPeriodeAmount}
                  onChange={(e) => setSisaPeriodeAmount(Math.max(0, Number(e.target.value) || 0))}
                />
              </div>
              <p className="text-xs text-muted-foreground">Default: {remainingDays} × {formatRp(dailyRate)} = {formatRp(remainingDays * dailyRate)}</p>
            </div>

            {/* Sisa Cuti */}
            <div className="space-y-1">
              <Label>Sisa cuti tahunan (uang penggantian)</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number" min={0}
                  value={sisaCutiDays}
                  onChange={(e) => setSisaCutiDays(Math.max(0, Number(e.target.value) || 0))}
                  placeholder="Hari"
                />
                <Input
                  type="number" min={0}
                  value={sisaCutiAmount}
                  onChange={(e) => setSisaCutiAmount(Math.max(0, Number(e.target.value) || 0))}
                />
              </div>
              <p className="text-xs text-muted-foreground">Default: hari × tarif harian. Bisa diedit manual.</p>
            </div>

            {/* Pesangon */}
            <div className="space-y-1">
              <Label>Pesangon / Uang pisah (UU 6/2023 + PP 35/2021)</Label>
              <Input
                type="number" min={0}
                value={pesangonAmount}
                onChange={(e) => setPesangonAmount(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>

            {/* Loan Payoff */}
            <div className="space-y-1">
              <Label>Pelunasan pinjaman (sisa pokok)</Label>
              <Input
                type="number" min={0}
                value={loanPayoff}
                onChange={(e) => setLoanPayoff(Math.max(0, Number(e.target.value) || 0))}
              />
              <p className="text-xs text-muted-foreground">Default: total sisa pokok pinjaman aktif. Akan dipotong dari final settlement.</p>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <Label>Catatan tambahan (opsional)</Label>
              <Textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="cth: BPJS Kesehatan akan dinonaktifkan H+1 ..."
              />
            </div>

            <Separator />

            {/* Summary */}
            <div className="rounded-md border p-3 bg-muted/40 text-sm space-y-1">
              <div className="flex justify-between"><span>Sisa periode</span><span>{formatRp(sisaPeriodeAmount)}</span></div>
              <div className="flex justify-between"><span>Sisa cuti</span><span>{formatRp(sisaCutiAmount)}</span></div>
              <div className="flex justify-between"><span>Pesangon</span><span>{formatRp(pesangonAmount)}</span></div>
              <div className="flex justify-between font-medium"><span>Total Bonus (bonus_lainnya)</span><span>{formatRp(totalBonus)}</span></div>
              <div className="flex justify-between text-destructive"><span>Pelunasan pinjaman</span><span>− {formatRp(totalDeduction)}</span></div>
              <Separator className="my-1" />
              <div className="flex justify-between font-semibold text-base"><span>Net Final Settlement</span><span>{formatRp(netSettlement)}</span></div>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Setelah disimpan, buka halaman <b>Payroll → {MONTHS[month - 1]} {year}</b> lalu <b>Generate Payroll</b>
                agar override ini diterapkan ke slip & bank export. Gaji prorata 21 {MONTHS[(month + 10) % 12]} – {resignDate ? format(resignDate, "dd MMM") : "-"} dihitung otomatis berdasarkan resign_date.
              </AlertDescription>
            </Alert>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Batal</Button>
          <Button onClick={handleSave} disabled={saving || loading || !resignDate}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Simpan ke Payroll Override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FinalSettlementDialog;
