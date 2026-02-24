import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Loader2, TrendingUp, DollarSign, Building2, Clock } from "lucide-react";
import { formatRupiah } from "@/lib/payrollCalculation";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

const COLORS = [
  "hsl(161, 80%, 35%)", "hsl(200, 70%, 50%)", "hsl(30, 80%, 55%)",
  "hsl(280, 60%, 55%)", "hsl(350, 70%, 55%)", "hsl(120, 50%, 45%)",
  "hsl(45, 80%, 50%)", "hsl(180, 60%, 45%)", "hsl(240, 50%, 55%)",
  "hsl(0, 60%, 55%)",
];

const currentYear = new Date().getFullYear();

const PayrollAnalytics = () => {
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [loading, setLoading] = useState(true);
  const [monthlyCost, setMonthlyCost] = useState<{ month: string; bruto: number; pph21: number; thp: number }[]>([]);
  const [deptCost, setDeptCost] = useState<{ name: string; value: number }[]>([]);
  const [monthlyOvertime, setMonthlyOvertime] = useState<{ month: string; hours: number; cost: number }[]>([]);
  const [totals, setTotals] = useState({ bruto: 0, pph21: 0, overtime: 0, overtimeHours: 0 });
  const { toast } = useToast();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 3 + i);

  useEffect(() => { fetchAnalytics(); }, [selectedYear]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // Fetch all periods for the year
      const { data: periods } = await supabase
        .from("payroll_periods").select("id, month")
        .eq("year", selectedYear).order("month");

      if (!periods || periods.length === 0) {
        setMonthlyCost([]); setDeptCost([]); setMonthlyOvertime([]);
        setTotals({ bruto: 0, pph21: 0, overtime: 0, overtimeHours: 0 });
        setLoading(false); return;
      }

      const periodIds = periods.map(p => p.id);
      const periodMonthMap = new Map(periods.map(p => [p.id, p.month]));

      const { data: payrolls } = await supabase
        .from("payroll").select("period_id, user_id, bruto_income, pph21_monthly, take_home_pay, overtime_total, overtime_hours")
        .in("period_id", periodIds);

      if (!payrolls) { setLoading(false); return; }

      // Get profiles for department info
      const userIds = [...new Set(payrolls.map(p => p.user_id))];
      const { data: profiles } = await supabase
        .from("profiles").select("id, departemen").in("id", userIds);
      const deptMap = new Map((profiles || []).map((p: any) => [p.id, p.departemen || "Lainnya"]));

      // Monthly aggregation
      const monthlyMap = new Map<number, { bruto: number; pph21: number; thp: number }>();
      const deptAgg = new Map<string, number>();
      const overtimeMonthly = new Map<number, { hours: number; cost: number }>();

      for (const p of payrolls) {
        const month = periodMonthMap.get(p.period_id) || 1;
        const m = monthlyMap.get(month) || { bruto: 0, pph21: 0, thp: 0 };
        m.bruto += p.bruto_income;
        m.pph21 += p.pph21_monthly;
        m.thp += p.take_home_pay;
        monthlyMap.set(month, m);

        const dept = deptMap.get(p.user_id) || "Lainnya";
        deptAgg.set(dept, (deptAgg.get(dept) || 0) + p.bruto_income);

        const ot = overtimeMonthly.get(month) || { hours: 0, cost: 0 };
        ot.hours += p.overtime_hours;
        ot.cost += p.overtime_total;
        overtimeMonthly.set(month, ot);
      }

      const monthlyData = Array.from({ length: 12 }, (_, i) => {
        const m = monthlyMap.get(i + 1);
        return { month: MONTHS[i], bruto: m?.bruto || 0, pph21: m?.pph21 || 0, thp: m?.thp || 0 };
      });

      const deptData = [...deptAgg.entries()]
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

      const overtimeData = Array.from({ length: 12 }, (_, i) => {
        const ot = overtimeMonthly.get(i + 1);
        return { month: MONTHS[i], hours: ot?.hours || 0, cost: ot?.cost || 0 };
      });

      setMonthlyCost(monthlyData);
      setDeptCost(deptData);
      setMonthlyOvertime(overtimeData);
      setTotals({
        bruto: monthlyData.reduce((s, m) => s + m.bruto, 0),
        pph21: monthlyData.reduce((s, m) => s + m.pph21, 0),
        overtime: overtimeData.reduce((s, m) => s + m.cost, 0),
        overtimeHours: overtimeData.reduce((s, m) => s + m.hours, 0),
      });
    } catch (error: any) {
      toast({ title: "Gagal memuat analytics", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload) return null;
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <p className="font-medium text-sm mb-1">{label}</p>
        {payload.map((entry: any, idx: number) => (
          <p key={idx} className="text-xs" style={{ color: entry.color }}>
            {entry.name}: {formatRupiah(entry.value)}
          </p>
        ))}
      </div>
    );
  };

  const PieTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.[0]) return null;
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <p className="font-medium text-sm">{payload[0].name}</p>
        <p className="text-xs">{formatRupiah(payload[0].value)}</p>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-7 w-7 text-primary" /> Payroll Analytics
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Analisis biaya gaji, pajak, departemen, dan lembur perusahaan
            </p>
          </div>
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : monthlyCost.every(m => m.bruto === 0) ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Belum ada data payroll untuk tahun {selectedYear}</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card><CardContent className="pt-6 flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-primary/60" />
                <div><p className="text-lg font-bold">{formatRupiah(totals.bruto)}</p><p className="text-xs text-muted-foreground">Total Biaya Gaji</p></div>
              </CardContent></Card>
              <Card><CardContent className="pt-6 flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-destructive/60" />
                <div><p className="text-lg font-bold">{formatRupiah(totals.pph21)}</p><p className="text-xs text-muted-foreground">Total PPh 21</p></div>
              </CardContent></Card>
              <Card><CardContent className="pt-6 flex items-center gap-3">
                <Building2 className="h-8 w-8 text-primary/40" />
                <div><p className="text-lg font-bold">{deptCost.length}</p><p className="text-xs text-muted-foreground">Departemen</p></div>
              </CardContent></Card>
              <Card><CardContent className="pt-6 flex items-center gap-3">
                <Clock className="h-8 w-8 text-primary/40" />
                <div><p className="text-lg font-bold">{totals.overtimeHours} jam</p><p className="text-xs text-muted-foreground">Total Lembur ({formatRupiah(totals.overtime)})</p></div>
              </CardContent></Card>
            </div>

            {/* Monthly Cost Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Total Biaya Gaji & Pajak Per Bulan</CardTitle>
                <CardDescription>Trend bulanan bruto, THP, dan PPh 21 tahun {selectedYear}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyCost} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                      <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(0)}jt`} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar dataKey="bruto" name="Bruto" fill="hsl(161, 80%, 35%)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="thp" name="Take Home Pay" fill="hsl(200, 70%, 50%)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="pph21" name="PPh 21" fill="hsl(350, 70%, 55%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Department Cost Pie */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Biaya Per Departemen</CardTitle>
                  <CardDescription>Distribusi biaya bruto per departemen tahun {selectedYear}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={deptCost} cx="50%" cy="50%" outerRadius={100} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                          {deptCost.map((_, idx) => (
                            <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<PieTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-4 justify-center">
                    {deptCost.map((dept, idx) => (
                      <div key={dept.name} className="flex items-center gap-1.5 text-xs">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                        {dept.name}: {formatRupiah(dept.value)}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Overtime Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Total Lembur Perusahaan</CardTitle>
                  <CardDescription>Jam dan biaya lembur per bulan tahun {selectedYear}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyOvertime} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                        <YAxis yAxisId="left" tickFormatter={(v) => `${v} jam`} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                        <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${(v / 1000000).toFixed(0)}jt`} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                        <Tooltip content={({ active, payload, label }: any) => {
                          if (!active || !payload) return null;
                          return (
                            <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                              <p className="font-medium text-sm mb-1">{label}</p>
                              <p className="text-xs" style={{ color: "hsl(30, 80%, 55%)" }}>Jam: {payload[0]?.value || 0} jam</p>
                              <p className="text-xs" style={{ color: "hsl(280, 60%, 55%)" }}>Biaya: {formatRupiah(payload[1]?.value || 0)}</p>
                            </div>
                          );
                        }} />
                        <Legend />
                        <Bar yAxisId="left" dataKey="hours" name="Jam Lembur" fill="hsl(30, 80%, 55%)" radius={[4, 4, 0, 0]} />
                        <Bar yAxisId="right" dataKey="cost" name="Biaya Lembur" fill="hsl(280, 60%, 55%)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PayrollAnalytics;
