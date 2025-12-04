import DashboardLayout from "@/components/DashboardLayout";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import StatsCards from "@/components/dashboard/StatsCards";
import AttendanceChart from "@/components/dashboard/AttendanceChart";
import DepartmentBreakdown from "@/components/dashboard/DepartmentBreakdown";
import RecentActivity from "@/components/dashboard/RecentActivity";
import PendingRequests from "@/components/dashboard/PendingRequests";
import { format, subDays } from "date-fns";
import { id } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

const Dashboard = () => {
  const { toast } = useToast();

  const [stats, setStats] = useState({
    totalEmployees: 0,
    presentToday: 0,
    absentToday: 0,
    lateToday: 0,
    earlyLeaveToday: 0,
    pendingLeave: 0,
    pendingOvertime: 0,
    totalOvertimeHours: 0,
  });
  const [recentAttendance, setRecentAttendance] = useState<any[]>([]);
  const [pendingLeave, setPendingLeave] = useState<any[]>([]);
  const [pendingOvertime, setPendingOvertime] = useState<any[]>([]);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [departmentData, setDepartmentData] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();

    // Real-time listener for attendance
    const attendanceChannel = supabase
      .channel("realtime:attendance")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, (payload) => {
        console.log("Realtime attendance change:", payload);

        if (payload.eventType === "INSERT") {
          setRecentAttendance((prev) => [payload.new, ...prev]);
        } else if (payload.eventType === "UPDATE") {
          setRecentAttendance((prev) => prev.map((r) => (r.id === payload.new.id ? payload.new : r)));
        }

        toast({
          title: "Update Absensi",
          description:
            payload.eventType === "INSERT" ? "Karyawan baru melakukan Check-In" : "Karyawan melakukan Check-Out",
        });

        fetchDashboardData();
      })
      .subscribe();

    // Real-time listener for leave requests
    const leaveChannel = supabase
      .channel("realtime:leave_requests_dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "leave_requests" }, (payload) => {
        console.log("Realtime leave change:", payload);
        
        if (payload.eventType === "INSERT") {
          toast({
            title: "Pengajuan Cuti Baru",
            description: "Ada permintaan cuti baru masuk",
          });
        }
        
        fetchDashboardData();
      })
      .subscribe();

    // Real-time listener for overtime requests
    const overtimeChannel = supabase
      .channel("realtime:overtime_requests_dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "overtime_requests" }, (payload) => {
        console.log("Realtime overtime change:", payload);
        
        if (payload.eventType === "INSERT") {
          toast({
            title: "Pengajuan Lembur Baru",
            description: "Ada permintaan lembur baru masuk",
          });
        }
        
        fetchDashboardData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(attendanceChannel);
      supabase.removeChannel(leaveChannel);
      supabase.removeChannel(overtimeChannel);
    };
  }, []);

  const fetchDashboardData = async () => {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    const [
      { count: employeeCount },
      { data: profiles },
      { data: todayAttendance },
      { data: recentData },
      { data: leaveData },
      { data: overtimeData },
      { data: weekAttendance },
    ] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("profiles").select("id, departemen"),
      supabase
        .from("attendance")
        .select("*")
        .gte("check_in_time", startOfToday.toISOString())
        .lte("check_in_time", endOfToday.toISOString()),
      supabase
        .from("attendance")
        .select("*, profiles:user_id(full_name, departemen)")
        .order("check_in_time", { ascending: false })
        .limit(10),
      supabase
        .from("leave_requests")
        .select("*, profiles:user_id(full_name)")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("overtime_requests")
        .select("*, profiles:user_id(full_name)")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase.from("attendance").select("*").gte("check_in_time", subDays(today, 7).toISOString()),
    ]);

    const present = todayAttendance?.filter((a) => a.status === "hadir").length || 0;
    const late = todayAttendance?.filter((a) => a.status === "terlambat").length || 0;
    const earlyLeave = todayAttendance?.filter((a) => a.status === "pulang_cepat").length || 0;
    const totalCheckedIn = todayAttendance?.length || 0;
    const absent = (employeeCount || 0) - totalCheckedIn;

    setStats({
      totalEmployees: employeeCount || 0,
      presentToday: present + late,
      absentToday: absent,
      lateToday: late,
      earlyLeaveToday: earlyLeave,
      pendingLeave: leaveData?.length || 0,
      pendingOvertime: overtimeData?.length || 0,
      totalOvertimeHours: 0,
    });

    setRecentAttendance(recentData || []);
    setPendingLeave(leaveData || []);
    setPendingOvertime(overtimeData || []);

    const weeklyStats: Record<string, { hadir: number; terlambat: number; tidak_hadir: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const date = subDays(today, i);
      const key = format(date, "yyyy-MM-dd");
      weeklyStats[key] = { hadir: 0, terlambat: 0, tidak_hadir: 0 };
    }

    weekAttendance?.forEach((rec) => {
      const day = format(new Date(rec.check_in_time), "yyyy-MM-dd");
      if (weeklyStats[day]) {
        if (rec.status === "hadir") weeklyStats[day].hadir++;
        else if (rec.status === "terlambat") weeklyStats[day].terlambat++;
      }
    });

    const chartData = Object.entries(weeklyStats).map(([date, d]) => ({
      day: format(new Date(date), "EEE", { locale: id }),
      ...d,
      tidak_hadir: Math.max(0, (employeeCount || 0) - d.hadir - d.terlambat),
    }));
    setWeeklyData(chartData);

    const deptMap: Record<string, { total: number; present: number }> = {};
    profiles?.forEach((p) => {
      const dept = p.departemen || "Lainnya";
      if (!deptMap[dept]) deptMap[dept] = { total: 0, present: 0 };
      deptMap[dept].total++;
    });

    todayAttendance?.forEach((a) => {
      const profile = profiles?.find((p) => p.id === a.user_id);
      const dept = profile?.departemen || "Lainnya";
      if (deptMap[dept]) deptMap[dept].present++;
    });

    const deptData = Object.entries(deptMap)
      .map(([name, d]) => ({ name, value: d.total, present: d.present }))
      .filter((d) => d.value > 0)
      .slice(0, 6);

    setDepartmentData(deptData);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fadeIn">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">{format(new Date(), "EEEE, d MMMM yyyy", { locale: id })}</p>
        </div>

        <StatsCards stats={stats} />

        <div className="grid gap-4 md:grid-cols-3">
          <AttendanceChart data={weeklyData} />
          <DepartmentBreakdown data={departmentData} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <RecentActivity data={recentAttendance} />
          <PendingRequests leaveRequests={pendingLeave} overtimeRequests={pendingOvertime} />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
