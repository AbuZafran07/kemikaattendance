import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, CheckCircle2, XCircle, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { notifyEmployee, NotificationTemplates, formatLeaveTypeForNotification, formatDateForNotification } from "@/lib/notifications";
import ApprovalReasonDialog from "@/components/ApprovalReasonDialog";

const Leave = () => {
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const { userRole } = useAuth();
  const { toast } = useToast();
  const isAdmin = userRole === "admin";
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState<"approve" | "reject">("approve");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  // Pagination
  const totalPages = Math.ceil(leaveRequests.length / itemsPerPage);
  const paginatedRequests = leaveRequests.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    fetchLeaveRequests();

    // Real-time listener for leave requests
    const channel = supabase
      .channel("realtime:leave_requests")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leave_requests" },
        (payload) => {
          console.log("Leave request change:", payload);
          fetchLeaveRequests();
          
          if (payload.eventType === "INSERT") {
            toast({
              title: "Pengajuan Cuti Baru",
              description: "Ada permintaan cuti baru masuk",
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchLeaveRequests = async () => {
    console.log("Fetching leave requests...");
    
    // Fetch leave requests first
    const { data: leaveData, error: leaveError } = await supabase
      .from("leave_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (leaveError) {
      console.error("Error fetching leave requests:", leaveError);
      toast({
        title: "Gagal Memuat Data",
        description: leaveError.message,
        variant: "destructive",
      });
      return;
    }

    if (!leaveData || leaveData.length === 0) {
      setLeaveRequests([]);
      return;
    }

    // Get unique user IDs
    const userIds = [...new Set(leaveData.map(r => r.user_id))];
    
    // Fetch profiles for those users
    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, nik, departemen")
      .in("id", userIds);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
    }

    // Create a map of profiles
    const profilesMap = new Map(
      (profilesData || []).map(p => [p.id, p])
    );

    // Combine leave requests with profiles
    const combinedData = leaveData.map(request => ({
      ...request,
      profiles: profilesMap.get(request.user_id) || null
    }));

    console.log("Leave requests fetched:", combinedData);
    setLeaveRequests(combinedData);
  };

  const openApprovalDialog = (requestId: string, action: "approve" | "reject") => {
    setSelectedRequestId(requestId);
    setDialogAction(action);
    setDialogOpen(true);
  };

  const handleApprove = async (reason: string) => {
    if (!selectedRequestId) return;
    
    const request = leaveRequests.find(r => r.id === selectedRequestId);
    
    const { error } = await supabase
      .from("leave_requests")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approval_notes: reason,
      })
      .eq("id", selectedRequestId);

    if (error) {
      toast({
        title: "Gagal Menyetujui",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    } else {
      toast({
        title: "Berhasil",
        description: "Permintaan cuti telah disetujui",
      });
      
      if (request) {
        const leaveType = formatLeaveTypeForNotification(request.leave_type);
        const startDate = formatDateForNotification(request.start_date);
        const endDate = formatDateForNotification(request.end_date);
        const notification = NotificationTemplates.leaveRequestApproved(leaveType, startDate, endDate);
        notifyEmployee(request.user_id, notification.title, notification.body, { type: 'leave_approved' });
      }
      
      fetchLeaveRequests();
    }
  };

  const handleReject = async (reason: string) => {
    if (!selectedRequestId) return;
    
    const request = leaveRequests.find(r => r.id === selectedRequestId);
    
    const { error } = await supabase
      .from("leave_requests")
      .update({
        status: "rejected",
        rejection_reason: reason,
      })
      .eq("id", selectedRequestId);

    if (error) {
      toast({
        title: "Gagal Menolak",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    } else {
      toast({
        title: "Berhasil",
        description: "Permintaan cuti telah ditolak",
      });
      
      if (request) {
        const leaveType = formatLeaveTypeForNotification(request.leave_type);
        const notification = NotificationTemplates.leaveRequestRejected(leaveType, reason);
        notifyEmployee(request.user_id, notification.title, notification.body, { type: 'leave_rejected' });
      }
      
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
            <div className="overflow-auto max-h-[calc(100vh-400px)]">
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
                  {paginatedRequests.length > 0 ? (
                    paginatedRequests.map((request) => (
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
                                <Button size="sm" onClick={() => openApprovalDialog(request.id, "approve")}>
                                  <CheckCircle2 className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => openApprovalDialog(request.id, "reject")}>
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Menampilkan {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, leaveRequests.length)} dari {leaveRequests.length} data
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
          </CardContent>
        </Card>
      </div>
      
      <ApprovalReasonDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        action={dialogAction}
        onConfirm={dialogAction === "approve" ? handleApprove : handleReject}
        title="Permintaan Cuti"
      />
    </DashboardLayout>
  );
};

export default Leave;
