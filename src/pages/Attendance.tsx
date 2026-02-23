import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, CheckCircle2, XCircle, RefreshCw, Camera, Calendar, Eye, ChevronLeft, ChevronRight, Pencil, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { getAttendancePhotoUrl } from "@/lib/attendancePhotoUpload";

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
  const navigate = useNavigate();
  const { user, userRole } = useAuth();
  const isAdmin = userRole === 'admin';
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState({
    totalRecords: 0,
    lateCount: 0,
    onTimeCount: 0,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; type: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const { toast } = useToast();

  // Edit state
  const [editRecord, setEditRecord] = useState<AttendanceRecord | null>(null);
  const [editCheckIn, setEditCheckIn] = useState("");
  const [editCheckOut, setEditCheckOut] = useState("");
  const [editReason, setEditReason] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete state
  const [deleteRecord, setDeleteRecord] = useState<AttendanceRecord | null>(null);
  const [isDeletingRecord, setIsDeletingRecord] = useState(false);




  useEffect(() => {
    // Set default date range to today
    const today = new Date().toISOString().split("T")[0];
    setStartDate(today);
    setEndDate(today);
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

    // Fetch admin user IDs first - admins are excluded from attendance tracking
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    
    const adminUserIds = new Set((adminRoles || []).map(r => r.user_id));

    // Fetch ALL attendance data within date range
    const { data: attendanceRecords, error: attendanceError } = await supabase
      .from("attendance")
      .select("*")
      .gte("check_in_time", startDateTime.toISOString())
      .lte("check_in_time", endDateTime.toISOString())
      .order("check_in_time", { ascending: false });

    if (attendanceError) {
      console.error("Error fetching attendance:", attendanceError);
      toast({
        title: "Error",
        description: "Gagal memuat data absensi",
        variant: "destructive",
      });
      setIsRefreshing(false);
      return;
    }

    // Filter out admin attendance records
    const nonAdminAttendance = (attendanceRecords || []).filter(
      record => !adminUserIds.has(record.user_id)
    );

    if (nonAdminAttendance.length === 0) {
      setAttendanceData([]);
      setStats({ totalRecords: 0, lateCount: 0, onTimeCount: 0 });
      setIsRefreshing(false);
      return;
    }

    // Fetch all profiles (excluding admins for display)
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, departemen, photo_url");

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
    }

    const profilesMap = new Map<string, Profile>();
    if (profiles) {
      profiles.forEach((p) => profilesMap.set(p.id, p));
    }

    // Merge attendance with profiles
    const mergedData: AttendanceRecord[] = nonAdminAttendance.map((record) => {
      const profile = profilesMap.get(record.user_id);
      return {
        ...record,
        full_name: profile?.full_name || "Unknown",
        departemen: profile?.departemen || "-",
        photo_url: profile?.photo_url,
      };
    });

    setAttendanceData(mergedData);

    // Calculate statistics
    const totalRecords = mergedData.length;
    const lateCount = mergedData.filter((record) => record.status === "terlambat").length;
    const onTimeCount = mergedData.filter((record) => record.status === "hadir").length;

    setStats({
      totalRecords,
      lateCount,
      onTimeCount,
    });

    setIsRefreshing(false);
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Filter by search query
  const filteredData = attendanceData.filter((record) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const name = (record.full_name || "").toLowerCase();
    const date = formatDate(record.check_in_time).toLowerCase();
    return name.includes(query) || date.includes(query);
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );


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
        return <Badge className="bg-primary text-white">Hadir</Badge>;
      case "terlambat":
        return <Badge variant="destructive">Terlambat</Badge>;
      case "pulang cepat":
      case "pulang_cepat":
        return <Badge variant="destructive">Pulang Cepat</Badge>; // ✅ warna merah seperti "Terlambat"
      default:
        return <Badge variant="outline">{status.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}</Badge>;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const openPhotoDialog = async (url: string | null, type: string) => {
    if (url) {
      // Get signed URL for storage paths
      const signedUrl = await getAttendancePhotoUrl(url);
      if (signedUrl) {
        setSelectedPhoto({ url: signedUrl, type });
      }
    }
  };

  // Open edit dialog
  const openEditDialog = (record: AttendanceRecord) => {
    setEditRecord(record);
    // Format datetime-local value
    const ciDate = new Date(record.check_in_time);
    const ciLocal = new Date(ciDate.getTime() - ciDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setEditCheckIn(ciLocal);
    if (record.check_out_time) {
      const coDate = new Date(record.check_out_time);
      const coLocal = new Date(coDate.getTime() - coDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setEditCheckOut(coLocal);
    } else {
      setEditCheckOut("");
    }
    setEditReason("");
  };

  const handleSaveEdit = async () => {
    if (!editRecord || !editReason.trim()) {
      toast({ title: "Error", description: "Alasan perubahan wajib diisi", variant: "destructive" });
      return;
    }
    setIsSavingEdit(true);
    try {
      const oldData = {
        check_in_time: editRecord.check_in_time,
        check_out_time: editRecord.check_out_time,
      };
      const newCheckIn = new Date(editCheckIn).toISOString();
      const newCheckOut = editCheckOut ? new Date(editCheckOut).toISOString() : null;
      const newData = { check_in_time: newCheckIn, check_out_time: newCheckOut };

      // Calculate duration
      let durationMinutes: number | null = null;
      if (newCheckOut) {
        durationMinutes = Math.round((new Date(newCheckOut).getTime() - new Date(newCheckIn).getTime()) / 60000);
      }

      // Update attendance record
      const { error: updateError } = await supabase
        .from("attendance")
        .update({ check_in_time: newCheckIn, check_out_time: newCheckOut, duration_minutes: durationMinutes })
        .eq("id", editRecord.id);

      if (updateError) throw updateError;

      // Insert audit log
      await supabase.from("attendance_audit_logs").insert({
        attendance_id: editRecord.id,
        action_type: "edit",
        changed_by: user!.id,
        old_data: oldData,
        new_data: newData,
        reason: editReason.trim(),
      });

      toast({ title: "Berhasil", description: "Data absensi berhasil diperbarui" });
      setEditRecord(null);
      fetchAttendanceData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Gagal memperbarui data", variant: "destructive" });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteRecord = async () => {
    if (!deleteRecord) return;
    setIsDeletingRecord(true);
    try {
      const oldData = {
        id: deleteRecord.id,
        user_id: deleteRecord.user_id,
        full_name: deleteRecord.full_name,
        check_in_time: deleteRecord.check_in_time,
        check_out_time: deleteRecord.check_out_time,
        status: deleteRecord.status,
      };

      // Insert audit log first
      await supabase.from("attendance_audit_logs").insert({
        attendance_id: deleteRecord.id,
        action_type: "delete",
        changed_by: user!.id,
        old_data: oldData,
        new_data: null,
        reason: `Dihapus oleh admin`,
      });

      // Delete the record
      const { error } = await supabase.from("attendance").delete().eq("id", deleteRecord.id);
      if (error) throw error;

      toast({ title: "Berhasil", description: "Data absensi berhasil dihapus" });
      setDeleteRecord(null);
      fetchAttendanceData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Gagal menghapus data", variant: "destructive" });
    } finally {
      setIsDeletingRecord(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Rekap Absensi</h1>
            <p className="text-muted-foreground mt-1">Data rekap absensi seluruh karyawan</p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => navigate("/dashboard/attendance/audit-log")}>
                <Calendar className="h-4 w-4 mr-1" />
                Audit Log
              </Button>
            )}
            <Button variant="outline" size="icon" onClick={fetchAttendanceData} disabled={isRefreshing}>
              <RefreshCw className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
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
            <div className="flex flex-col sm:flex-row items-end gap-4">
              <div className="space-y-2">
                <Label>Tanggal Mulai</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Tanggal Akhir</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>

              {/* Tombol Terapkan Filter */}
              <div>
                <Button
                  variant="default"
                  onClick={fetchAttendanceData}
                  disabled={!startDate || !endDate || isRefreshing}
                >
                  Tampilkan
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Absensi</CardTitle>
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
              <CardTitle className="text-sm font-medium text-muted-foreground">Tepat Waktu</CardTitle>
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
              <CardTitle className="text-sm font-medium text-muted-foreground">Terlambat</CardTitle>
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>Data Rekap Absensi</CardTitle>
                <CardDescription>
                  Periode: {startDate && formatDate(startDate)} - {endDate && formatDate(endDate)}
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari nama atau tanggal..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {attendanceData.length > 0 ? (
              <>
                <div className="overflow-auto max-h-[calc(100vh-500px)]">
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
                        {isAdmin && <TableHead>Aksi</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedData.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={record.photo_url || undefined} />
                                <AvatarFallback className="text-xs">
                                  {getInitials(record.full_name || "U")}
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
                          <TableCell>{record.check_out_time ? formatTime(record.check_out_time) : "-"}</TableCell>
                          <TableCell>{calculateDuration(record.check_in_time, record.check_out_time)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {record.check_in_photo_url && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => openPhotoDialog(record.check_in_photo_url, "Check-In")}
                                >
                                  <Camera className="h-4 w-4 text-primary" />
                                </Button>
                              )}
                              {record.check_out_photo_url && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => openPhotoDialog(record.check_out_photo_url, "Check-Out")}
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
                              <MapPin
                                className={`h-4 w-4 ${record.gps_validated ? "text-primary" : "text-destructive"}`}
                              />
                              <span className="text-sm">{record.gps_validated ? "Valid" : "Invalid"}</span>
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(record.status)}</TableCell>
                          {isAdmin && (
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEditDialog(record)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => setDeleteRecord(record)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      Menampilkan {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, attendanceData.length)} dari {attendanceData.length} data
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm">
                        {currentPage} / {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">Tidak ada data absensi pada periode ini</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Photo Preview Dialog */}
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Foto {selectedPhoto?.type}</DialogTitle>
            <DialogDescription>Foto absensi karyawan</DialogDescription>
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

      {/* Edit Attendance Dialog */}
      <Dialog open={!!editRecord} onOpenChange={(open) => !open && setEditRecord(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Waktu Absensi</DialogTitle>
            <DialogDescription>
              {editRecord?.full_name} - {editRecord && formatDate(editRecord.check_in_time)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Check-In</Label>
              <Input type="datetime-local" value={editCheckIn} onChange={(e) => setEditCheckIn(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Check-Out</Label>
              <Input type="datetime-local" value={editCheckOut} onChange={(e) => setEditCheckOut(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Alasan Perubahan <span className="text-destructive">*</span></Label>
              <Textarea placeholder="Contoh: Koreksi waktu check-in karena lupa absen" value={editReason} onChange={(e) => setEditReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRecord(null)} disabled={isSavingEdit}>Batal</Button>
            <Button onClick={handleSaveEdit} disabled={isSavingEdit || !editReason.trim()}>
              {isSavingEdit ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Attendance Confirmation */}
      <AlertDialog open={!!deleteRecord} onOpenChange={(open) => !open && setDeleteRecord(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Data Absensi</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus data absensi <strong>{deleteRecord?.full_name}</strong> pada tanggal <strong>{deleteRecord && formatDate(deleteRecord.check_in_time)}</strong>? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingRecord}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRecord} disabled={isDeletingRecord} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeletingRecord ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default Attendance;
