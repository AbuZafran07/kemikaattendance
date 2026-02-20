import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Download, FileSpreadsheet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { exportToExcelFile } from '@/lib/excelExport';
import logo from "@/assets/logo.png";
import { EmployeeBottomNav } from "@/components/EmployeeBottomNav";

const AttendanceHistory = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAttendanceHistory();
  }, []);

  const fetchAttendanceHistory = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', profile?.id)
        .order('check_in_time', { ascending: false });

      if (error) throw error;
      setAttendanceRecords(data || []);
    } catch (error) {
      console.error('Error fetching attendance:', error);
      toast({
        title: "Error",
        description: "Gagal mengambil data absensi",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const exportToExcel = async () => {
    const exportData = attendanceRecords.map(record => ({
      'Tanggal': new Date(record.check_in_time).toLocaleDateString('id-ID'),
      'Check-In': new Date(record.check_in_time).toLocaleTimeString('id-ID'),
      'Check-Out': record.check_out_time ? new Date(record.check_out_time).toLocaleTimeString('id-ID') : '-',
      'Durasi (menit)': record.duration_minutes || '-',
      'Status': record.status,
      'Validasi GPS': record.gps_validated ? 'Ya' : 'Tidak',
      'Validasi Wajah': record.face_recognition_validated ? 'Ya' : 'Tidak',
      'Catatan': record.notes || '-'
    }));

    const fileName = `Absensi_${profile?.full_name}_${new Date().toISOString().split('T')[0]}.xlsx`;
    await exportToExcelFile(exportData, 'Riwayat Absensi', fileName);

    toast({
      title: "Berhasil",
      description: "Riwayat absensi berhasil diunduh",
    });
  };

  const formatStatus = (status: string) => {
    const statusMap: Record<string, string> = {
      'hadir': 'Hadir',
      'terlambat': 'Terlambat',
      'pulang_cepat': 'Pulang Cepat',
      'tidak_hadir': 'Tidak Hadir'
    };
    return statusMap[status] || status;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/10 pb-24">
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/employee')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <img src={logo} alt="Kemika" className="h-10 object-contain" />
          </div>
          <Button onClick={exportToExcel} disabled={attendanceRecords.length === 0} size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>Riwayat Absensi</CardTitle>
            <CardDescription>
              Total: {attendanceRecords.length} record absensi
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Memuat data...</div>
            ) : attendanceRecords.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Belum ada data absensi
              </div>
            ) : (
              <div className="space-y-4">
                {attendanceRecords.map((record) => (
                  <div key={record.id} className="border border-border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold">
                          {new Date(record.check_in_time).toLocaleDateString('id-ID', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatStatus(record.status)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          Check-In: {new Date(record.check_in_time).toLocaleTimeString('id-ID')}
                        </p>
                        {record.check_out_time && (
                          <p className="text-sm font-medium">
                            Check-Out: {new Date(record.check_out_time).toLocaleTimeString('id-ID')}
                          </p>
                        )}
                      </div>
                    </div>
                    {record.duration_minutes && (
                      <p className="text-sm text-muted-foreground">
                        Durasi kerja: {Math.floor(record.duration_minutes / 60)} jam {record.duration_minutes % 60} menit
                      </p>
                    )}
                    {record.notes && (
                      <p className="text-sm text-muted-foreground mt-2">
                        {record.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <EmployeeBottomNav />
    </div>
  );
};

export default AttendanceHistory;
