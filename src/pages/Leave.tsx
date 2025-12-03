import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const Leave = () => {
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const { userRole } = useAuth();
  const { toast } = useToast();
  const isAdmin = userRole === "admin";

  useEffect(() => {
    fetchLeaveRequests();
  }, []);

  const fetchLeaveRequests = async () => {
    const query = supabase
      .from("leave_requests")
      .select(
        `
        *,
        profiles:user_id(full_name, nik, departemen)
      `,
      )
      .order("created_at", { ascending: false });

    const { data } = await query;

    if (data) {
      setLeaveRequests(data);
    }
  };

  const handleApprove = async (requestId: string) => {
    const { error } = await supabase
      .from("leave_requests")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (error) {
      toast({
        title: "Gagal Menyetujui",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Berhasil",
        description: "Permintaan cuti telah disetujui",
      });
      fetchLeaveRequests();
    }
  };

  const handleReject = async (requestId: string) => {
    const { error } = await supabase
      .from("leave_requests")
      .update({
        status: "rejected",
        rejection_reason: "Ditolak oleh admin",
      })
      .eq("id", requestId);

    if (error) {
      toast({
        title: "Gagal Menolak",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Berhasil",
        description: "Permintaan cuti telah ditolak",
      });
      fetchLeaveRequests();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-primary">Disetujui</Badge>;
      case "rejected":
        return <Badge variant="destructive">Ditolak</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

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
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manajemen Cuti</h1>
          <p className="text-muted-foreground mt-1">Kelola permintaan cuti dan izin karyawan</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Permintaan</CardTitle>
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
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-secondary" />
                <span className="text-3xl font-bold">{leaveRequests.filter((r) => r.status === "pending").length}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Disetujui</CardTitle>
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
                        <TableCell className="font-medium">{request.profiles?.full_name}</TableCell>
                        <TableCell>{request.profiles?.nik}</TableCell>
                        <TableCell>{request.profiles?.departemen}</TableCell>
                        <TableCell>{formatLeaveType(request.leave_type)}</TableCell>
                        <TableCell>
                          {new Date(request.start_date).toLocaleDateString("id-ID")} -
                          {new Date(request.end_date).toLocaleDateString("id-ID")}
                        </TableCell>
                        <TableCell>{request.total_days} hari</TableCell>
                        <TableCell className="max-w-xs truncate">{request.reason}</TableCell>
                        <TableCell>{getStatusBadge(request.status)}</TableCell>
                        {isAdmin && (
                          <TableCell>
                            {request.status === "pending" && (
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => handleApprove(request.id)}>
                                  <CheckCircle2 className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => handleReject(request.id)}>
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 9 : 8} className="text-center py-8 text-muted-foreground">
                        Belum ada permintaan cuti
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Leave;
