import { useState, useEffect, useCallback, useMemo, type ElementType } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Users, Clock, CheckCircle2, AlertTriangle, TrendingUp, FileWarning, Lock, ClipboardList, ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Stats {
  total_employees: number;
  total_late: number;
  approved_late: number;
  monthly_violations: number;
  rolling_violations: number;
  employees_sp1: number;
  employees_sp2: number;
  employees_early_warning: number;
  locked_accounts: number;
}

interface EmployeeRow {
  user_id: string;
  full_name: string;
  departemen: string;
  account_status: string;
  monthly_violations: number;
  rolling_violations: number;
  warning_level: string | null;
}

const EMPTY_STATS: Stats = {
  total_employees: 0,
  total_late: 0,
  approved_late: 0,
  monthly_violations: 0,
  rolling_violations: 0,
  employees_sp1: 0,
  employees_sp2: 0,
  employees_early_warning: 0,
  locked_accounts: 0,
};

const currentMonthValue = () => new Date().toISOString().slice(0, 7);

const AttendanceDisciplineDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [month, setMonth] = useState(currentMonthValue());
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [warningFilter, setWarningFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const monthDate = `${month}-01`;
      const [{ data: statsData, error: statsError }, { data: rowsData, error: rowsError }] = await Promise.all([
        (supabase.rpc as any)("get_attendance_discipline_dashboard_stats", { p_month: monthDate }),
        (supabase.rpc as any)("get_attendance_discipline_employee_rows", { p_month: monthDate }),
      ]);

      if (statsError) throw statsError;
      if (rowsError) throw rowsError;

      setStats((statsData as unknown as Stats) || EMPTY_STATS);
      setRows((rowsData as unknown as EmployeeRow[]) || []);
    } catch (error) {
      toast({
        title: "Gagal Memuat Dashboard",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [month, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const departments = useMemo(
    () => [...new Set(rows.map((r) => r.departemen).filter(Boolean))].sort(),
    [rows]
  );

  const filteredRows = rows.filter((r) => {
    if (departmentFilter !== "all" && r.departemen !== departmentFilter) return false;
    if (warningFilter !== "all" && (r.warning_level || "none") !== warningFilter) return false;
    if (statusFilter !== "all" && r.account_status !== statusFilter) return false;
    return true;
  });

  const summaryCards: Array<{ label: string; value: number; icon: ElementType; color: string }> = [
    { label: "Total Karyawan", value: stats.total_employees, icon: Users, color: "text-primary" },
    { label: "Total Terlambat", value: stats.total_late, icon: Clock, color: "text-orange-500" },
    { label: "Terlambat Disetujui", value: stats.approved_late, icon: CheckCircle2, color: "text-green-600" },
    { label: "Pelanggaran Bulan Ini", value: stats.monthly_violations, icon: FileWarning, color: "text-destructive" },
    { label: "Pelanggaran 3 Bulan", value: stats.rolling_violations, icon: TrendingUp, color: "text-destructive" },
    { label: "Karyawan SP1", value: stats.employees_sp1, icon: AlertTriangle, color: "text-yellow-600" },
    { label: "Karyawan SP2", value: stats.employees_sp2, icon: AlertTriangle, color: "text-orange-600" },
    { label: "Peringatan Dini", value: stats.employees_early_warning, icon: ShieldCheck, color: "text-blue-600" },
    { label: "Akun Terkunci", value: stats.locked_accounts, icon: Lock, color: "text-destructive" },
  ];

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Dashboard Disiplin Absensi</h2>
            <p className="text-sm text-muted-foreground mt-1">Ringkasan pelanggaran, SP, dan lock akun karyawan</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/dashboard/coaching")}>
              <ClipboardList className="h-4 w-4 mr-1" />
              Pembinaan
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="month" className="text-sm whitespace-nowrap">
            Bulan
          </Label>
          <Input id="month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />
        </div>

        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {summaryCards.map((card) => (
            <Card key={card.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">{card.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                  <span className="text-2xl font-bold">{isLoading ? "-" : card.value}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ringkasan per Karyawan</CardTitle>
            <CardDescription>{filteredRows.length} dari {rows.length} karyawan aktif</CardDescription>
            <div className="flex flex-wrap gap-2 pt-2">
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-44"><SelectValue placeholder="Departemen" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Departemen</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={warningFilter} onValueChange={setWarningFilter}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Warning Level" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Level</SelectItem>
                  <SelectItem value="none">Tidak Ada</SelectItem>
                  <SelectItem value="sp1">SP1</SelectItem>
                  <SelectItem value="sp2">SP2</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Status Akun" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="active">Aktif</SelectItem>
                  <SelectItem value="locked">Terkunci</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Memuat data...</div>
            ) : filteredRows.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Tidak ada data untuk filter ini</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Karyawan</TableHead>
                      <TableHead>Departemen</TableHead>
                      <TableHead>Pelanggaran Bulan Ini</TableHead>
                      <TableHead>Pelanggaran 3 Bulan</TableHead>
                      <TableHead>Warning Level</TableHead>
                      <TableHead>Status Akun</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.map((row) => (
                      <TableRow key={row.user_id}>
                        <TableCell className="font-medium">{row.full_name}</TableCell>
                        <TableCell>{row.departemen}</TableCell>
                        <TableCell>{row.monthly_violations}</TableCell>
                        <TableCell>{row.rolling_violations}</TableCell>
                        <TableCell>
                          {row.warning_level ? (
                            <Badge variant={row.warning_level === "sp2" ? "destructive" : "secondary"}>
                              {row.warning_level.toUpperCase()}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {row.account_status === "locked" ? (
                            <Badge variant="destructive">Terkunci</Badge>
                          ) : (
                            <Badge variant="outline">Aktif</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.warning_level ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setLetterTarget({ userId: row.user_id, name: row.full_name })}
                            >
                              <FileWarning className="h-4 w-4 mr-1" />
                              Surat SP
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
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
    </>
  );
};

export default AttendanceDisciplineDashboard;
