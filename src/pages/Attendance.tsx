import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AttendanceRecord {
  id: string;
  user_id: string;
  check_in_time: string;
  check_out_time: string | null;
  status: string;
  duration_minutes: number | null;
  gps_validated: boolean;
  profiles: {
    full_name: string;
    departemen: string;
  };
}

const Attendance = () => {
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState({
    totalCheckIn: 0,
    lateCount: 0,
    notCheckedOut: 0,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchAttendanceData();
    setupRealtimeSubscription();
  }, []);

  const fetchAttendanceData = async () => {
    setIsRefreshing(true);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('attendance')
      .select(`
        *,
        profiles!attendance_user_id_fkey(full_name, departemen)
      `)
      .gte('check_in_time', today.toISOString())
      .order('check_in_time', { ascending: false });

    if (error) {
      console.error('Error fetching attendance:', error);
      toast({
        title: "Error",
        description: "Gagal memuat data absensi",
        variant: "destructive",
      });
    } else if (data) {
      setAttendanceData(data as any);
      
      // Calculate statistics
      const totalCheckIn = data.length;
      const lateCount = data.filter((record: any) => record.status === 'terlambat').length;
      const notCheckedOut = data.filter((record: any) => !record.check_out_time).length;
      
      setStats({
        totalCheckIn,
        lateCount,
        notCheckedOut,
      });
    }
    setIsRefreshing(false);
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('attendance-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance'
        },
        (payload) => {
          console.log('Attendance real-time update:', payload);
          fetchAttendanceData();
          
          if (payload.eventType === 'INSERT') {
            toast({
              title: "Check-In Baru",
              description: "Karyawan baru saja check-in",
            });
          } else if (payload.eventType === 'UPDATE') {
            toast({
              title: "Update Absensi",
              description: "Data absensi diperbarui",
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateDuration = (checkIn: string, checkOut: string | null) => {
    if (!checkOut) return "-";
    
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffMs = end.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "hadir":
        return <Badge className="bg-primary">Hadir</Badge>;
      case "terlambat":
        return <Badge variant="destructive">Terlambat</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCurrentDate = () => {
    return new Date().toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Absensi Real-Time</h1>
            <p className="text-muted-foreground mt-1">
              Monitoring kehadiran karyawan hari ini
            </p>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={fetchAttendanceData}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Check-In
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <span className="text-3xl font-bold">{stats.totalCheckIn}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Terlambat
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-destructive" />
                <span className="text-3xl font-bold">{stats.lateCount}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Belum Check-Out
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-muted-foreground" />
                <span className="text-3xl font-bold">{stats.notCheckedOut}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Data Absensi Hari Ini</CardTitle>
            <CardDescription>
              {getCurrentDate()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {attendanceData.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama</TableHead>
                      <TableHead>Departemen</TableHead>
                      <TableHead>Check-In</TableHead>
                      <TableHead>Check-Out</TableHead>
                      <TableHead>Durasi</TableHead>
                      <TableHead>Lokasi</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendanceData.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">{record.profiles.full_name}</TableCell>
                        <TableCell>{record.profiles.departemen}</TableCell>
                        <TableCell className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          {formatTime(record.check_in_time)}
                        </TableCell>
                        <TableCell>
                          {record.check_out_time ? formatTime(record.check_out_time) : '-'}
                        </TableCell>
                        <TableCell>
                          {calculateDuration(record.check_in_time, record.check_out_time)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <MapPin className={`h-4 w-4 ${record.gps_validated ? 'text-primary' : 'text-destructive'}`} />
                            <span className="text-sm">
                              {record.gps_validated ? 'Valid' : 'Invalid'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(record.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Belum ada data absensi hari ini
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Attendance;
