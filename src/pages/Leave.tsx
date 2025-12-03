import DashboardLayout from "@/components/DashboardLayout";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, CheckCircle2, XCircle, Clock } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const Leave = () => {
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { userRole } = useAuth();
  const { toast } = useToast();
  const isAdmin = userRole === "admin";

  useEffect(() => {
    fetchLeaveRequests();
  }, []);

  // 🔹 Fetch semua data cuti
  const fetchLeaveRequests = async () => {
    const { data, error } = await supabase
      .from("leave_requests")
      .select(`
        *,
        profiles:user_id(full_name, nik, departemen)
      `)
      .order("status", { ascending: true }) // tampilkan pending dulu
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Gagal Memuat Data",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setLeaveRequests(data || []);
    }
  };

  // 🔹 Fungsi menyetujui permintaan cuti
  const handleApprove = async (requestId: string) => {
    if (loading) return;
    setLoading(true);

    const { error } = await supabase
      .from("leave_requests")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    setLoading(false);
    if (error) {
      toast({
        title: "Gagal Menyetujui",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Berhasil",
        description: "Permintaan cuti telah disetujui.",
      });
      fetchLeaveRequests();
    }
  };

  // 🔹 Fungsi menolak permintaan cuti
  const handleReject = async (requestId: string) => {
    if (loading) return;
    setLoading(true);

    const { error } = await supabase
      .from("leave_requests")
      .update({
        status: "rejected",
        rejection_reason: "Ditolak oleh admin",
      })
      .eq("id", requestId);

    setLoading(false);
    if (error) {
      toast({
        title: "Gagal Menolak",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Berhasil",
        description: "Permintaan cuti telah ditolak.",
      });
      fetchLeaveRequests();
    }
  };

  // 🔹 Tampilkan status dengan warna badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-primary text-white">Disetujui</Badge>;
      case "rejected":
        return <Badge variant="destructive">Ditolak</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // 🔹 Mapping tipe cuti
  const formatLeaveType = (type: string) => {
    const typeMap: Record<string, string> = {
      cuti_tahunan: "Cuti Tahunan",
      izin: "Izin",
      sakit: "Sakit",
      lupa_absen: "Lupa Absen",
    };
    return typeMap[type] || type;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fadeIn">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manajemen Cuti</h1>
          <p className="text-muted-foreground mt-1">
            Kelola dan setujui permintaan cuti karyawan
          </p>
        </div>

        {/* Statistik singkat */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Permintaan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <span className="text-3xl font-bold">{leaveRequests.length}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-secondary" />
                <span className="text-3xl font-bold">
                  {leaveRequests.filter((r) => r.status === "pending").length}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Disetujui
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <span className="text-3xl font-bold">
                  {leaveRequests.filter((r) => r.status === "approved").length}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabel Daftar Permintaan */}
        <Card>
          <CardHeader>
            <CardTitle>Daftar Permintaan Cuti</CardTitle>
            <CardDescription>Semua permintaan cuti dan izin karyawan</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>NIK</TableHead>
                    <TableHead>Departemen</TableHead>
                    <TableHead>Jenis</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Durasi</TableHead>
                    <TableHead>Alasan</TableHead>
                    <TableHead>Status</TableHead>
                    {isAdmin && <TableHead>Aksi</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaveRequests.length > 0 ? (
                    leaveRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium">
                          {request.profiles?.full_name}
                        </TableCell>
                        <TableCell>{request.profiles?.nik || "-"}</TableCell>
                        <TableCell>{request.profiles?.departemen || "-"}</TableCell>
                        <TableCell>{formatLeaveType(request.leave_type)}</TableCell>
                        <TableCell>
                          {new Date(request.start_date).toLocaleDateString("id-ID")} -{" "}
                          {new Date(request.end_date).toLocaleDateString("id-ID")}
                        </TableCell>
                        <TableCell>{request.total_days} hari</TableCell>
                        <TableCell className="max-w-xs truncate">
                          {request.reason || "-"}
                        </TableCell>
                        <TableCell>{getStatusBadge(request.status)}</TableCell>
                        {isAdmin && (
                          <TableCell>
                            {request.status === "pending" ? (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleApprove(request.id)}
                                  disabled={loading}
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleReject(request.id)}
                                  disabled={loading}
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {request.status === "approved"
                                  ? "✅ Disetujui"
                                  : "❌ Ditolak"}
                              </span>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={isAdmin ? 9 : 8}
                        classNam
