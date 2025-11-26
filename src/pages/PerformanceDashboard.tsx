import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, TrendingUp, Calendar, Clock, Award } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/logo.png";

const PerformanceDashboard = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    totalPresent: 0,
    totalLate: 0,
    attendanceRate: 0,
    totalOvertimeHours: 0,
    remainingLeave: profile?.remaining_leave || 0,
    usedLeave: (profile?.annual_leave_quota || 12) - (profile?.remaining_leave || 0)
  });

  useEffect(() => {
    fetchPerformanceStats();
  }, []);

  const fetchPerformanceStats = async () => {
    try {
      // Get current month date range
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      // Fetch attendance data
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', profile?.id)
        .gte('check_in_time', firstDay.toISOString())
        .lte('check_in_time', lastDay.toISOString());

      // Fetch overtime data
      const { data: overtimeData } = await supabase
        .from('overtime_requests')
        .select('hours')
        .eq('user_id', profile?.id)
        .eq('status', 'approved')
        .gte('overtime_date', firstDay.toISOString().split('T')[0])
        .lte('overtime_date', lastDay.toISOString().split('T')[0]);

      const totalPresent = attendanceData?.filter(a => a.status === 'hadir').length || 0;
      const totalLate = attendanceData?.filter(a => a.status === 'terlambat').length || 0;
      const totalDays = attendanceData?.length || 0;
      const totalOvertimeHours = overtimeData?.reduce((sum, o) => sum + o.hours, 0) || 0;

      setStats({
        totalPresent,
        totalLate,
        attendanceRate: totalDays > 0 ? Math.round((totalPresent / totalDays) * 100) : 0,
        totalOvertimeHours,
        remainingLeave: profile?.remaining_leave || 0,
        usedLeave: (profile?.annual_leave_quota || 12) - (profile?.remaining_leave || 0)
      });
    } catch (error) {
      console.error('Error fetching performance stats:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/10">
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/employee')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <img src={logo} alt="Kemika" className="h-10 object-contain" />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Dashboard Performa</CardTitle>
            <CardDescription>
              Ringkasan performa Anda bulan ini
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Attendance Rate */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Tingkat Kehadiran</p>
                <p className="text-3xl font-bold text-primary">{stats.attendanceRate}%</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold">{stats.totalPresent}</p>
                <p className="text-sm text-muted-foreground">Hadir Tepat Waktu</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold">{stats.totalLate}</p>
                <p className="text-sm text-muted-foreground">Terlambat</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Overtime Hours */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Total Jam Lembur</p>
                <p className="text-3xl font-bold text-primary">{stats.totalOvertimeHours}</p>
                <p className="text-xs text-muted-foreground">jam bulan ini</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Leave Balance */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Saldo Cuti Tahunan</p>
                <p className="text-3xl font-bold text-primary">{stats.remainingLeave}</p>
                <p className="text-xs text-muted-foreground">hari tersisa dari {profile?.annual_leave_quota || 12} hari</p>
              </div>
            </div>
            <div className="mt-4">
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all" 
                  style={{ width: `${(stats.remainingLeave / (profile?.annual_leave_quota || 12)) * 100}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Terpakai: {stats.usedLeave} hari
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Achievement Badge */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="inline-flex h-16 w-16 rounded-full bg-primary/10 items-center justify-center mb-3">
                <Award className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-1">
                {stats.attendanceRate >= 95 ? 'Karyawan Teladan' : 
                 stats.attendanceRate >= 85 ? 'Karyawan Baik' : 
                 'Tingkatkan Kehadiran'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {stats.attendanceRate >= 95 ? 'Luar biasa! Anda memiliki tingkat kehadiran sempurna!' : 
                 stats.attendanceRate >= 85 ? 'Bagus! Pertahankan tingkat kehadiran Anda!' : 
                 'Tingkatkan kehadiran Anda untuk performa yang lebih baik'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PerformanceDashboard;
