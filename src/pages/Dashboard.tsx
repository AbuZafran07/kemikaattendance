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

const Dashboard = () => {
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
  }, []);

  const fetchDashboardData = async () => {
    const today = new Date();

    // Gunakan waktu lokal (WIB)
    const toWIB = (date: Date) => {
      const utc = date.getTime() + date.getTimezoneOffset() * 60000;
      return new Date(utc + 7 * 60 * 60 * 1000);
    };

    const startOfToday = toWIB(new Date());
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = toWIB(new Date());
    endOfToday.setHours(23, 59, 59, 999);

    // Fetch all data paralel
    const [
      { count: employeeCount },
      { data: profiles },
      { data: todayAttendance, error: attendanceError },
      { data: recentData },
      { data: leaveData },
      { data: overtimeData },
      { data: weekAttendance },
    ] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("profiles").select("id, departemen"),

      // 🟢 Ambil absensi hari ini berdasarkan check_in_time (bukan created_at)
      supabase
        .from("attendance")
        .select("*")
        .gte("check_in_time", startOfToday.toISOString())
        .lte("check_in_time", endOfToday.toISOString()),

      // 🟢 Ambil 10 aktivitas absensi terbaru
      supabase
        .from("attendance")
        .select("*, profiles:user_id(full_name, departemen)")
        .order("check_in_time", { ascending: false })
        .limit(20),

      // 🟢 Ambil cuti yang status-nya pending/menunggu
      supabase
        .from("leave_requests")
        .select("*, profiles:user_id(full_name)")
        .in("status", ["pending", "menunggu", "diajukan"])
        .order("created_at", { ascending: false })
        .limit(5),

      // 🟢 Ambil lembur yang status-nya pending/menunggu
      supabase
        .from("overtime_requests")
        .select("*, profiles:user_id(full_name)")
        .in("status", ["pending", "menunggu", "diajukan"])
        .order("created_at", { ascending: false })
        .limit(5),

      // 🟢 Ambil data absensi 7 hari terakhir
      supabase.from("attendance").select("*").gte("check_in_time", subDays(today, 7).toISOString()),
    ]);

    // ✅ Hitung Statistik Hari Ini
    const present = todayAttendance?.filter((a) => a.status === "hadir").length || 0;
    const late = todayAttendance?.filter((a) => a.status === "terlambat").length || 0;
    const earlyLeave = todayAttendance?.filter((a) => a.status === "pulang cepat").length || 0;
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

    if (recentData) setRecentAttendance(recentData);
    if (leaveData) setPendingLeave(leaveData);
    if (overtimeData) setPendingOvertime(overtimeData);

    // ✅ Proses Grafik Mingguan
    const weeklyStats: Record<string, { hadir: number; terlambat: number; tidak hadir: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const date = subDays(today, i);
      const dayKey = format(date, "yyyy-MM-dd");
      const dayLabel = format(date, "EEE", { locale: id });
      weeklyStats[dayKey] = { hadir: 0, terlambat: 0, tidak hadir: 0 };
    }

    weekAttendance?.forEach((record) => {
      const recordDate = format(new Date(record.check_in_time), "yyyy-MM-dd");
      if (weeklyStats[recordDate]) {
        if (record.status === "hadir") weeklyStats[recordDate].hadir++;
        else if (record.status === "terlambat") weeklyStats[recordDate].terlambat++;
      }
    });

    const chartData = Object.entries(weeklyStats).map(([date, data]) => ({
      day: format(new Date(date), "EEE", { locale: id }),
      ...data,
      tidak hadir: Math.max(0, (employeeCount || 0) - data.hadir - data.terlambat),
    }));
    setWeeklyData(chartData);

    // ✅ Hitung Kehadiran per Departemen
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
      .map(([name, data]) => ({
        name: name.replace(" Department", ""),
        value: data.total,
        present: data.present,
      }))
      .filter((d) => d.value > 0)
      .slice(0, 6);

    setDepartmentData(deptData);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
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
