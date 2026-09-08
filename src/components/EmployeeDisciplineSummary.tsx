import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface EmployeeDisciplineSummaryProps {
  userId: string;
  accountStatus: string;
}

interface SummaryState {
  totalAttendance: number;
  totalLate: number;
  approvedLate: number;
  rejectedLate: number;
  monthlyViolations: number;
  rollingViolations: number;
  activeWarnings: string[];
  earlyWarning: boolean;
}

const EMPTY: SummaryState = {
  totalAttendance: 0,
  totalLate: 0,
  approvedLate: 0,
  rejectedLate: 0,
  monthlyViolations: 0,
  rollingViolations: 0,
  activeWarnings: [],
  earlyWarning: false,
};

const EmployeeDisciplineSummary = ({ userId, accountStatus }: EmployeeDisciplineSummaryProps) => {
  const [summary, setSummary] = useState<SummaryState>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSummary = async () => {
      setIsLoading(true);
      const today = new Date().toISOString().slice(0, 10);

      const [
        { count: totalAttendance },
        { count: totalLate },
        { data: lateReasons },
        { data: monthlyCount },
        { data: rollingCount },
        { data: warnings },
      ] = await Promise.all([
        supabase.from("attendance").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase
          .from("attendance")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "terlambat"),
        supabase.from("late_reasons").select("status").eq("user_id", userId),
        supabase.rpc("get_monthly_violation_count", { p_user_id: userId, p_month: today }),
        supabase.rpc("get_rolling_3month_violation_count", { p_user_id: userId, p_reference_date: today }),
        supabase
          .from("disciplinary_actions")
          .select("warning_type")
          .eq("user_id", userId)
          .eq("status", "active")
          .order("issue_date", { ascending: false })
          .limit(5),
      ]);

      const approvedLate = (lateReasons || []).filter((r) => r.status === "approved").length;
      const rejectedLate = (lateReasons || []).filter((r) => r.status === "rejected").length;

      const config = await supabase.rpc("get_attendance_discipline_config");
      const warnThreshold = (config.data as { three_month_warning_threshold?: number } | null)?.three_month_warning_threshold ?? 10;

      setSummary({
        totalAttendance: totalAttendance || 0,
        totalLate: totalLate || 0,
        approvedLate,
        rejectedLate,
        monthlyViolations: (monthlyCount as unknown as number) || 0,
        rollingViolations: (rollingCount as unknown as number) || 0,
        activeWarnings: [...new Set((warnings || []).map((w) => w.warning_type))],
        earlyWarning: ((rollingCount as unknown as number) || 0) >= warnThreshold,
      });
      setIsLoading(false);
    };

    fetchSummary();
  }, [userId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ShieldAlert className="h-5 w-5" />
          Disiplin Absensi
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 bg-muted rounded-lg">
                <p className="text-xl font-bold">{summary.totalAttendance}</p>
                <p className="text-xs text-muted-foreground">Total Kehadiran</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <p className="text-xl font-bold">{summary.totalLate}</p>
                <p className="text-xs text-muted-foreground">Total Terlambat</p>
              </div>
              <div className="text-center p-3 bg-green-500/10 rounded-lg">
                <p className="text-xl font-bold text-green-600">{summary.approvedLate}</p>
                <p className="text-xs text-muted-foreground">Terlambat Disetujui</p>
              </div>
              <div className="text-center p-3 bg-destructive/10 rounded-lg">
                <p className="text-xl font-bold text-destructive">{summary.rejectedLate}</p>
                <p className="text-xs text-muted-foreground">Terlambat Ditolak</p>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-sm text-muted-foreground">Pelanggaran Bulan Ini</span>
              <span className="font-semibold">{summary.monthlyViolations}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Pelanggaran 3 Bulan Terakhir</span>
              <span className="font-semibold">{summary.rollingViolations}</span>
            </div>
            {summary.earlyWarning && (
              <Badge variant="secondary" className="w-full justify-center">Peringatan Dini 3 Bulan</Badge>
            )}

            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
              {summary.activeWarnings.map((w) => (
                <Badge key={w} variant={w === "sp2" ? "destructive" : "secondary"}>
                  {w.toUpperCase()}
                </Badge>
              ))}
              <Badge variant={accountStatus === "locked" ? "destructive" : "outline"}>
                {accountStatus === "locked" ? "Akun Terkunci" : "Akun Aktif"}
              </Badge>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default EmployeeDisciplineSummary;
