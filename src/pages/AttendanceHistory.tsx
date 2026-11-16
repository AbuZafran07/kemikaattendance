import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, FileSpreadsheet } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { exportToExcelFile } from '@/lib/excelExport';
import logo from "@/assets/logo.png";
import { EmployeeBottomNav } from "@/components/EmployeeBottomNav";
import { useWebMCP } from "use-webmcp-tool";
import { runWebMCPTool } from "@/lib/webmcp-telemetry";
import LateReasonDialog from "@/components/LateReasonDialog";
import { useLateReasonWindow } from "@/hooks/use-late-reason-window";
import { isWithinLateReasonDeadline } from "@/lib/lateReasonDeadline";

const AttendanceHistory = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedDate = searchParams.get("date");
  const selectedDate = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : null;
  const { profile } = useAuth();
  const { toast } = useToast();
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [lateReasonStatusMap, setLateReasonStatusMap] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [reasonRecord, setReasonRecord] = useState<any | null>(null);
  const [isSubmittingReason, setIsSubmittingReason] = useState(false);
  const { deadlineHours, serverNow } = useLateReasonWindow();

  const submitReason = async (reason: string) => {
    if (!reasonRecord || isSubmittingReason) return;
    setIsSubmittingReason(true);
    try {
      const { error } = await supabase.rpc("submit_late_reason", {
        p_attendance_id: reasonRecord.id,
        p_reason: reason,
      });
      if (error) throw error;
      setReasonRecord(null);
      await fetchAttendanceHistory();
      toast({ title: "Alasan Terkirim", description: "Menunggu keputusan HR." });
    } catch (error) {
      toast({ title: "Alasan Gagal Dikirim", description: (error as { message?: string }).message || "Silakan coba kembali.", variant: "destructive" });
    } finally {
      setIsSubmittingReason(false);
    }
  };

  useWebMCP({
    name: "read_visible_attendance",
    description: "Read the attendance records currently shown on the employee's attendance history screen, without notes, photos, or location data.",
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    enabled: Boolean(profile?.id) && profile?.status === "Active" && !["BOD", "Komisaris"].includes(profile?.departemen) && !isLoading,
    execute: () => runWebMCPTool("read_visible_attendance", () => attendanceRecords.length
      ? attendanceRecords.slice(0, 50).map(record => `${record.id}: ${new Date(record.check_in_time).toLocaleDateString('id-ID')}; ${record.status}; check-in ${new Date(record.check_in_time).toLocaleTimeString('id-ID')}${record.check_out_time ? `; check-out ${new Date(record.check_out_time).toLocaleTimeString('id-ID')}` : ''}`).join("\n")
      : "Tidak ada absensi pada tampilan ini."),
  });

  useEffect(() => {
    fetchAttendanceHistory();
  }, [profile?.id, selectedDate]);

  const fetchAttendanceHistory = async () => {
    if (!profile?.id) return;
    setIsLoading(true);
    try {
      let query = supabase
        .from('attendance')
        .select('*')
        .eq('user_id', profile?.id)
        .order('check_in_time', { ascending: false });
      if (selectedDate) {
        const start = new Date(`${selectedDate}T00:00:00+07:00`);
        query = query.gte('check_in_time', start.toISOString()).lt('check_in_time', new Date(start.getTime() + 86400000).toISOString());
      }
      const { data, error } = await query;

      if (error) throw error;
      setAttendanceRecords(data || []);

      const { data: lateReasons, error: reasonError } = await supabase
        .from('late_reasons')
        .select('attendance_id, status')
        .eq('user_id', profile?.id);
      if (reasonError) throw reasonError;

      const map: Record<string, string> = {};
      (lateReasons || []).forEach((lr) => {
        map[lr.attendance_id] = lr.status;
      });
      setLateReasonStatusMap(map);
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

  const lateReasonBadge = (attendanceId: string) => {
    const status = lateReasonStatusMap[attendanceId];
    if (!status) return null;
    const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
      pending: { label: "Alasan: Menunggu Persetujuan", variant: "secondary" },
      approved: { label: "Alasan: Disetujui", variant: "default" },
      rejected: { label: "Alasan: Ditolak", variant: "destructive" },
      no_reason_submitted: { label: "Alasan Tidak Diajukan", variant: "destructive" },
    };
    const c = config[status];
    if (!c) return null;
    return <Badge variant={c.variant} className="mt-1">{c.label}</Badge>;
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
            {selectedDate && <div className="flex items-center justify-between gap-2">
              <Badge variant="secondary">{selectedDate}</Badge>
              <Button variant="ghost" size="sm" onClick={() => setSearchParams({})}>Semua Tanggal</Button>
            </div>}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Memuat data...</div>
            ) : attendanceRecords.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {selectedDate ? `Tidak ada catatan absensi pada ${selectedDate}` : "Belum ada data absensi"}
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
                        {(record.status === 'terlambat' || record.late_minutes > 0) && lateReasonBadge(record.id)}
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
                    {(record.status === 'terlambat' || record.late_minutes > 0) && !lateReasonStatusMap[record.id] && (
                      deadlineHours === undefined ? <p className="text-xs text-muted-foreground mt-3">Memeriksa batas waktu alasan...</p> : isWithinLateReasonDeadline(record.check_in_time, deadlineHours, serverNow) ?
                      <Button variant="outline" size="sm" className="mt-3" disabled={isSubmittingReason} onClick={() => setReasonRecord(record)}>
                        Kirim Alasan
                      </Button>
                      : <Badge variant="secondary" className="mt-3">Batas waktu alasan lewat</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <EmployeeBottomNav />
      <LateReasonDialog
        key={reasonRecord?.id || "closed"}
        open={Boolean(reasonRecord)}
        type="terlambat"
        durationText={`${reasonRecord?.late_minutes || 0} menit terlambat`}
        deadlineHours={deadlineHours}
        onConfirm={submitReason}
        onCancel={() => setReasonRecord(null)}
        isSubmitting={isSubmittingReason}
      />
    </div>
  );
};

export default AttendanceHistory;
