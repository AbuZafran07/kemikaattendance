import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, CheckCircle2, XCircle, RefreshCw, Camera, Calendar, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  check_in_photo_url: string | null;
  check_out_photo_url: string | null;
  full_name?: string;
  departemen?: string;
  photo_url?: string;
}

interface Profile {
  id: string;
  full_name: string;
  departemen: string;
  photo_url: string | null;
}

const Attendance = () => {
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState({
    totalRecords: 0,
    lateCount: 0,
    onTimeCount: 0,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; type: string } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Set default date range to current month
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    setStartDate(firstDay.toISOString().split('T')[0]);
    setEndDate(lastDay.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      fetchAttendanceData();
    }
  }, [startDate, endDate]);

  const fetchAttendanceData = async () => {
    setIsRefreshing(true);

    const startDateTime = new Date(startDate);
    startDateTime.setHours(0, 0, 0, 0);
    
    const endDateTime = new Date(endDate);
    endDateTime.setHours(23, 59, 59, 999);

    // Fetch ALL attendance data within date range
    const { data: attendanceRecords, error: attendanceError } = await supabase
      .from('attendance')
      .select('*')
      .gte('check_in_time', startDateTime.toISOString())
      .lte('check_in_time', endDateTime.toISOString())
      .order('check_in_time', { ascending: false });

    if (attendanceError) {
      console.error('Error fetching attendance:', attendanceError);
      toast({
        title: "Error",
        description: "Gagal memuat data absensi",
        variant: "destructive",
      });
      setIsRefreshing(false);
      return;
    }

    if (!attendanceRecords || attendanceRecords.length === 0) {
      setAttendanceData([]);
      setStats({ totalRecords: 0, lateCount: 0, onTimeCount: 0 });
      setIsRefreshing(false);
      return;
    }

    // Fetch all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, departemen, photo_url');

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
    }

    const profilesMap = new Map<string, Profile>();
    if (profiles) {
      profiles.forEach((p) => profilesMap.set(p.id, p));
    }

    // Merge attendance with profiles
    const mergedData: AttendanceRecord[] = attendanceRecords.map((record) => {
      const profile = profilesMap.get(record.user_id);
      return {
        ...record,
        full_name: profile?.full_name || 'Unknown',
        departemen: profile?.departemen || '-',
        photo_url: profile?.photo_url,
      };
    });

    setAttendanceData(mergedData);
    
    // Calculate statistics
    const totalRecords = mergedData.length;
    const lateCount = mergedData.filter((record) => record.status === 'terlambat').length;
    const onTimeCount = mergedData.filter((record) => record.status === 'hadir').length;
    
    setStats({
      totalRecords,
      lateCount,
      onTimeCount,
    });
    
    setIsRefreshing(false);
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
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

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const openPhotoDialog = (url: string | null, type: string) => {
    if (url) {
      setSelectedPhoto({ url, type });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Rekap Absensi</h1>
            <p className="text-muted-foreground mt-1">
              Data rekap absensi seluruh karyawan
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

        {/* Date Filter */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Filter Tanggal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="space-y-2">
                <Label>Tanggal Mulai</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Tanggal Akhir</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Absensi
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <span className="text-3xl font-bold">{stats.totalRecords}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Tepat Waktu
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <span className="text-3xl font-bold">{stats.onTimeCount}</span>
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
                <XCircle className="h-5 w-5 text-destructive" />
                <span className="text-3xl font-bold">{stats.lateCount}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Data Rekap Absensi</CardTitle>
            <CardDescription>
              Periode: {startDate && formatDate(startDate)} - {endDate && formatDate(endDate)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {attendanceData.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Karyawan</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Check-In</TableHead>
                      <TableHead>Check-Out</TableHead>
                      <TableHead>Durasi</TableHead>
                      <TableHead>Foto Absen</TableHead>
                      <TableHead>Lokasi</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendanceData.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={record.photo_url || undefined} />
                              <AvatarFallback className="text-xs">
                                {getInitials(record.full_name || 'U')}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{record.full_name}</p>
                              <p className="text-xs text-muted-foreground">{record.departemen}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(record.check_in_time)}</TableCell>
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
                          <div className="flex items-center gap-2">
                            {record.check_in_photo_url && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => openPhotoDialog(record.check_in_photo_url, 'Check-In')}
                              >
                                <Camera className="h-4 w-4 text-primary" />
                              </Button>
                            )}
                            {record.check_out_photo_url && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => openPhotoDialog(record.check_out_photo_url, 'Check-Out')}
                              >
                                <Eye className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            )}
                            {!record.check_in_photo_url && !record.check_out_photo_url && (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </div>
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
                Tidak ada data absensi pada periode ini
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Photo Preview Dialog */}
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Foto {selectedPhoto?.type}</DialogTitle>
            <DialogDescription>
              Foto absensi karyawan
            </DialogDescription>
          </DialogHeader>
          {selectedPhoto && (
            <div className="flex justify-center">
              <img
                src={selectedPhoto.url}
                alt={`Foto ${selectedPhoto.type}`}
                className="max-w-full max-h-[60vh] rounded-lg object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Attendance;