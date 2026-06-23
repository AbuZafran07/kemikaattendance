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
  const [remainingLeaveDays, setRemainingLeaveDays] = useState<number>(0);
  const [pesangonAmount, setPesangonAmount] = useState<number>(0);
  const [loanPayoff, setLoanPayoff] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");

  // Period bounds (informational)
  const bounds = useMemo(() => getCutoffPeriodBounds(month, year, cutoffDay), [month, year, cutoffDay]);
  const basicSalary = Number(employee?.basic_salary) || 0;

  // Default month/year from resign_date when dialog opens
  useEffect(() => {
    if (open && resignDate) {
      const d = resignDate.getDate();
      const m = resignDate.getMonth() + 1;
      const y = resignDate.getFullYear();
      const periodMonth = d >= cutoffDay ? m + 1 : m;
      const periodYear = periodMonth > 12 ? y + 1 : y;
      setMonth(((periodMonth - 1) % 12) + 1);
      setYear(periodYear);
    }
  }, [open, employee?.id, cutoffDay]);

  // Load cutoff_day, profile.remaining_leave (info only) & outstanding loans
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
        setRemainingLeaveDays(Number(leaveLeft) || 0);
        const totalLoan = (loans || []).reduce((s: number, l: any) => s + (Number(l.remaining_amount) || 0), 0);
        setLoanPayoff(Math.round(totalLoan));
        setPesangonAmount(0);
        setNotes("");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, employee?.id]);

  const totalBonus = Math.max(0, pesangonAmount || 0);
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
      const breakdown: string[] = [
        `[Final Settlement ${MONTHS[month - 1]} ${year}]`,
        `Resign: ${format(resignDate, "dd MMM yyyy")}`,
        `Sisa cuti ${remainingLeaveDays} hari dipakai sbg hari kerja s/d tgl resign (tidak diuangkan)`,
        `Pesangon/uang pisah: ${formatRp(pesangonAmount)}`,
        `Pelunasan pinjaman: ${formatRp(loanPayoff)}`,
      ];
      if (notes.trim()) breakdown.push(`Catatan: ${notes.trim()}`);
      const mergedNotes = breakdown.join(" | ");

      const { data: existing } = await supabase
        .from("final_settlements" as any)
        .select("id")
        .eq("user_id", employee.id)
        .maybeSingle();

      const { data: { user } } = await supabase.auth.getUser();

      const payload: any = {
        user_id: employee.id,
        resign_date: employee.resign_date,
        period_month: month,
        period_year: year,
        pesangon_amount: totalBonus,
        loan_payoff: totalDeduction,
        remaining_leave_days: remainingLeaveDays,
        net_amount: netSettlement,
        notes: mergedNotes,
        status: "pending",
        created_by: user?.id ?? null,
      };

      if ((existing as any)?.id) {
        const { error } = await supabase.from("final_settlements" as any).update(payload).eq("id", (existing as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("final_settlements" as any).insert(payload);
        if (error) throw error;
      }

      toast({
        title: "Final Settlement tersimpan",
        description: `Tersimpan terpisah dari payroll bulanan. Buka Payroll → menu export → "e-Payroll Final Settlement" untuk transfer ke bank.`,
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
            Catatan Final Settlement (pesangon/uang pisah & pelunasan pinjaman) disimpan
            <b> terpisah dari payroll bulanan</b>. Slip Juni/Juli tetap berisi gaji prorata saja,
            sementara nilai settlement diekspor lewat <b>e-Payroll Final Settlement</b> di halaman Payroll.
            Sisa cuti <b>tidak diuangkan</b> — dipakai sebagai hari kerja s/d tanggal resign.
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
                Gapok: <b>{formatRp(basicSalary)}</b><br />
                Resign: <b>{resignDate ? format(resignDate, "dd MMM yyyy") : "-"}</b> · Sisa cuti: <b>{remainingLeaveDays} hari</b> (dipakai sbg hari kerja)<br />
                Gaji prorata <b>{format(bounds.start, "dd MMM")} – {resignDate ? format(resignDate, "dd MMM yyyy") : "-"}</b> dihitung otomatis oleh sistem payroll.
              </AlertDescription>
            </Alert>

            <Separator />

            {/* Pesangon */}
            <div className="space-y-1">
              <Label>Pesangon / Uang pisah (UU 6/2023 + PP 35/2021)</Label>
              <Input
                type="number" min={0}
                value={pesangonAmount}
                onChange={(e) => setPesangonAmount(Math.max(0, Number(e.target.value) || 0))}
              />
              <p className="text-xs text-muted-foreground">Isi sesuai perhitungan HR (kosongkan = 0 bila tidak ada).</p>
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
              <div className="flex justify-between"><span>Pesangon / uang pisah</span><span>{formatRp(pesangonAmount)}</span></div>
              <div className="flex justify-between font-medium"><span>Total Bonus (bonus_lainnya)</span><span>{formatRp(totalBonus)}</span></div>
              <div className="flex justify-between text-destructive"><span>Pelunasan pinjaman</span><span>− {formatRp(totalDeduction)}</span></div>
              <Separator className="my-1" />
              <div className="flex justify-between font-semibold text-base"><span>Net Final Settlement</span><span>{formatRp(netSettlement)}</span></div>
              <p className="text-xs text-muted-foreground pt-1">
                * Belum termasuk gaji prorata <b>{format(bounds.start, "dd MMM")} – {resignDate ? format(resignDate, "dd MMM") : "-"}</b> yang otomatis muncul saat generate payroll.
              </p>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Setelah disimpan, buka halaman <b>Payroll</b> → menu <b>Export</b> →
                <b> e-Payroll Final Settlement</b> untuk men-transfer nilai net ke bank.
                Slip & e-Payroll bulanan tidak terpengaruh.
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
