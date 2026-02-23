import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Calculator, FileText, Loader2, DollarSign, Users, TrendingUp, Lock } from "lucide-react";
import {
  calculatePayroll,
  calculateOvertimePay,
  formatRupiah,
  PTKP_VALUES,
} from "@/lib/payrollCalculation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  // joined client-side
  employee_name?: string;
  departemen?: string;
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
      // Check if period exists
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

      // Fetch payroll records
      const { data: payrolls } = await supabase
        .from("payroll")
        .select("*")
        .eq("period_id", periodData.id);

      if (!payrolls || payrolls.length === 0) {
        setPayrollData([]);
        setLoading(false);
        return;
      }

      // Fetch profiles separately (two-step join)
      const userIds = [...new Set(payrolls.map((p) => p.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, departemen")
        .in("id", userIds);

      const profileMap = new Map(
        (profiles || []).map((p) => [p.id, { name: p.full_name, dept: p.departemen }])
      );

      const enriched: PayrollData[] = payrolls.map((p) => ({
        ...p,
        employee_name: profileMap.get(p.user_id)?.name || "Unknown",
        departemen: profileMap.get(p.user_id)?.dept || "-",
      }));

      // Sort by name
      enriched.sort((a, b) => (a.employee_name || "").localeCompare(b.employee_name || ""));
      setPayrollData(enriched);
    } catch (error) {
      console.error("Error fetching payroll:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      // 1. Get or create period
      let periodId: string;
      const { data: existingPeriod } = await supabase
        .from("payroll_periods")
        .select("id, status")
        .eq("month", selectedMonth)
        .eq("year", selectedYear)
        .maybeSingle();

      if (existingPeriod?.status === "finalized") {
        toast({
          title: "Payroll Terkunci",
          description: "Payroll periode ini sudah difinalisasi dan tidak bisa di-generate ulang.",
          variant: "destructive",
        });
        setGenerating(false);
        return;
      }

      if (existingPeriod) {
        periodId = existingPeriod.id;
        // Delete existing payroll data for re-generation
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

      // 2. Fetch all active employees
      const { data: employees } = await supabase
        .from("profiles")
        .select("id, full_name, basic_salary, ptkp_status, status")
        .eq("status", "Active");

      if (!employees || employees.length === 0) {
        toast({
          title: "Tidak ada karyawan",
          description: "Tidak ditemukan karyawan aktif.",
          variant: "destructive",
        });
        setGenerating(false);
        return;
      }

      // 3. Fetch approved overtime for the period
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`;
      const endDate = new Date(selectedYear, selectedMonth, 0); // last day of month
      const endDateStr = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;

      const { data: overtimeData } = await supabase
        .from("overtime_requests")
        .select("user_id, hours")
        .eq("status", "approved")
        .gte("overtime_date", startDate)
        .lte("overtime_date", endDateStr);

      // Aggregate overtime per user
      const overtimeMap = new Map<string, number>();
      (overtimeData || []).forEach((ot) => {
        const current = overtimeMap.get(ot.user_id) || 0;
        overtimeMap.set(ot.user_id, current + ot.hours);
      });

      // 4. Calculate payroll for each employee
      const payrollRecords = employees.map((emp) => {
        const basicSalary = Number(emp.basic_salary) || 0;
        const overtimeHours = overtimeMap.get(emp.id) || 0;
        const overtimeTotal = calculateOvertimePay(basicSalary, overtimeHours);
        const ptkpStatus = emp.ptkp_status || "TK/0";

        const result = calculatePayroll({
          basicSalary,
          allowance: 0, // Can be extended later
          overtimeTotal,
          ptkpStatus,
          overtimeHours,
        });

        return {
          user_id: emp.id,
          period_id: periodId,
          ...result,
        };
      });

      // 5. Insert payroll records
      const { error: insertError } = await supabase
        .from("payroll")
        .insert(payrollRecords);

      if (insertError) throw insertError;

      toast({
        title: "Payroll Berhasil Di-generate",
        description: `${payrollRecords.length} karyawan telah dihitung untuk ${MONTHS[selectedMonth - 1].label} ${selectedYear}.`,
      });

      fetchPayrollData();
    } catch (error: any) {
      console.error("Error generating payroll:", error);
      toast({
        title: "Gagal Generate Payroll",
        description: error.message || "Terjadi kesalahan saat menghitung payroll.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleFinalize = async () => {
    if (!period) return;
    try {
      await supabase
        .from("payroll_periods")
        .update({ status: "finalized" })
        .eq("id", period.id);

      toast({
        title: "Payroll Difinalisasi",
        description: "Payroll periode ini sudah dikunci dan tidak bisa diubah.",
      });
      fetchPayrollData();
    } catch (error: any) {
      toast({ title: "Gagal", description: error.message, variant: "destructive" });
    }
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
              Kelola penggajian karyawan dengan perhitungan PPh 21 otomatis
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Month Filter */}
            <Select
              value={String(selectedMonth)}
              onValueChange={(v) => setSelectedMonth(Number(v))}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => (
                  <SelectItem key={m.value} value={String(m.value)}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Year Filter */}
            <Select
              value={String(selectedYear)}
              onValueChange={(v) => setSelectedYear(Number(v))}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={generating || period?.status === "finalized"}
              className="gap-2"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Calculator className="h-4 w-4" />
              )}
              Generate Payroll
            </Button>

            {/* Finalize */}
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
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Users className="h-8 w-8 text-primary/60" />
                  <div>
                    <p className="text-2xl font-bold">{payrollData.length}</p>
                    <p className="text-xs text-muted-foreground">Total Karyawan</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-8 w-8 text-blue-500/60" />
                  <div>
                    <p className="text-lg font-bold">{formatRupiah(totalBruto)}</p>
                    <p className="text-xs text-muted-foreground">Total Bruto</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-orange-500/60" />
                  <div>
                    <p className="text-lg font-bold">{formatRupiah(totalPPh)}</p>
                    <p className="text-xs text-muted-foreground">Total PPh 21</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <DollarSign className="h-8 w-8 text-green-500/60" />
                  <div>
                    <p className="text-lg font-bold">{formatRupiah(totalTHP)}</p>
                    <p className="text-xs text-muted-foreground">Total THP</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Payroll Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Data Payroll — {MONTHS[selectedMonth - 1].label} {selectedYear}
            </CardTitle>
            <CardDescription>
              Daftar penggajian karyawan beserta potongan dan pajak
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : payrollData.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Calculator className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Belum ada data payroll</p>
                <p className="text-sm mt-1">
                  Klik "Generate Payroll" untuk menghitung gaji periode ini
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">No</TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead>Departemen</TableHead>
                      <TableHead className="text-right">Gaji Pokok</TableHead>
                      <TableHead className="text-right">Lembur</TableHead>
                      <TableHead className="text-right">Bruto</TableHead>
                      <TableHead className="text-right">BPJS</TableHead>
                      <TableHead className="text-right">PPh 21</TableHead>
                      <TableHead className="text-right">THP</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payrollData.map((item, idx) => (
                      <TableRow key={item.id} className="cursor-pointer hover:bg-accent/50" onClick={() => setDetailItem(item)}>
                        <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-medium">{item.employee_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">{item.departemen}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm">{formatRupiah(item.basic_salary)}</TableCell>
                        <TableCell className="text-right text-sm">
                          {item.overtime_hours > 0 ? (
                            <span title={`${item.overtime_hours} jam`}>
                              {formatRupiah(item.overtime_total)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">{formatRupiah(item.bruto_income)}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {formatRupiah(item.bpjs_kesehatan + item.bpjs_ketenagakerjaan)}
                        </TableCell>
                        <TableCell className="text-right text-sm text-orange-600">{formatRupiah(item.pph21_monthly)}</TableCell>
                        <TableCell className="text-right text-sm font-bold text-primary">{formatRupiah(item.take_home_pay)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="text-xs" onClick={(e) => { e.stopPropagation(); setDetailItem(item); }}>
                            Detail
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Totals */}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell colSpan={3}>Total</TableCell>
                      <TableCell className="text-right">{formatRupiah(payrollData.reduce((s, p) => s + p.basic_salary, 0))}</TableCell>
                      <TableCell className="text-right">{formatRupiah(payrollData.reduce((s, p) => s + p.overtime_total, 0))}</TableCell>
                      <TableCell className="text-right">{formatRupiah(totalBruto)}</TableCell>
                      <TableCell className="text-right">{formatRupiah(payrollData.reduce((s, p) => s + p.bpjs_kesehatan + p.bpjs_ketenagakerjaan, 0))}</TableCell>
                      <TableCell className="text-right text-orange-600">{formatRupiah(totalPPh)}</TableCell>
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
                  <span className="text-muted-foreground">Tunjangan</span>
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
                  <span className="text-right text-orange-600 font-medium">-{formatRupiah(detailItem.pph21_monthly)}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <span className="text-base font-bold">Take Home Pay</span>
                  <span className="text-right text-base font-bold text-primary">{formatRupiah(detailItem.take_home_pay)}</span>
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
