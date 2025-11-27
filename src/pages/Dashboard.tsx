import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, UserX, Clock } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalEmployees: 0,
    presentToday: 0,
    absentToday: 0,
    lateToday: 0
  });
  const [recentAttendance, setRecentAttendance] = useState<any[]>([]);
  const [pendingLeave, setPendingLeave] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    // Fetch total employees
    const { count: employeeCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    // Fetch today's attendance
    const today = new Date().toISOString().split('T')[0];
    const { data: todayAttendance } = await supabase
      .from('attendance')
      .select('*')
      .gte('check_in_time', `${today}T00:00:00`)
      .lte('check_in_time', `${today}T23:59:59`);

    const present = todayAttendance?.filter(a => a.status === 'hadir').length || 0;
    const late = todayAttendance?.filter(a => a.status === 'terlambat').length || 0;
    const absent = (employeeCount || 0) - (todayAttendance?.length || 0);

    setStats({
      totalEmployees: employeeCount || 0,
      presentToday: present,
      absentToday: absent,
      lateToday: late
    });

    // Fetch recent attendance
    const { data: recentData } = await supabase
      .from('attendance')
      .select(`
        *,
        profiles:user_id(full_name, nik)
      `)
      .order('check_in_time', { ascending: false })
      .limit(4);

    if (recentData) {
      setRecentAttendance(recentData);
    }

    // Fetch pending leave requests
    const { data: leaveData } = await supabase
      .from('leave_requests')
      .select(`
        *,
        profiles:user_id(full_name)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(3);

    if (leaveData) {
      setPendingLeave(leaveData);
    }
  };

  const statsData = [
    {
      title: "Total Karyawan",
      value: stats.totalEmployees.toString(),
      icon: Users,
      description: "Karyawan aktif",
      color: "text-primary",
    },
    {
      title: "Hadir Hari Ini",
      value: stats.presentToday.toString(),
      icon: UserCheck,
      description: `${stats.totalEmployees > 0 ? Math.round((stats.presentToday / stats.totalEmployees) * 100) : 0}% kehadiran`,
      color: "text-primary",
    },
    {
      title: "Tidak Hadir",
      value: stats.absentToday.toString(),
      icon: UserX,
      description: `${stats.totalEmployees > 0 ? Math.round((stats.absentToday / stats.totalEmployees) * 100) : 0}% dari total`,
      color: "text-destructive",
    },
    {
      title: "Terlambat",
      value: stats.lateToday.toString(),
      icon: Clock,
      description: `${stats.totalEmployees > 0 ? Math.round((stats.lateToday / stats.totalEmployees) * 100) : 0}% dari hadir`,
      color: "text-secondary",
    },
  ];

  const formatStatus = (status: string) => {
    const statusMap: Record<string, string> = {
      'hadir': 'Tepat Waktu',
      'terlambat': 'Terlambat',
      'pulang_cepat': 'Pulang Cepat',
      'tidak_hadir': 'Tidak Hadir'
    };
    return statusMap[status] || status;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Selamat datang di Kemika HR Attendance System
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statsData.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Absensi Real-Time</CardTitle>
              <CardDescription>
                Monitoring kehadiran karyawan hari ini
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentAttendance.length > 0 ? (
                  recentAttendance.map((record) => (
                    <div key={record.id} className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <UserCheck className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{record.profiles?.full_name}</p>
                        <p className="text-sm text-muted-foreground">
                          Check-in: {new Date(record.check_in_time).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      <div className={`text-sm font-medium ${
                        record.status === 'hadir' ? 'text-primary' : 'text-secondary'
                      }`}>
                        {formatStatus(record.status)}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground py-4">Belum ada absensi hari ini</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Permintaan Cuti Pending</CardTitle>
              <CardDescription>
                Menunggu approval dari HRGA
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingLeave.length > 0 ? (
                  pendingLeave.map((request) => (
                    <div key={request.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                      <div>
                        <p className="font-medium">{request.profiles?.full_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(request.start_date).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short'
                          })} - {new Date(request.end_date).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                      <div className="text-xs bg-secondary/10 text-secondary px-2 py-1 rounded">
                        Pending
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground py-4">Tidak ada permintaan pending</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
