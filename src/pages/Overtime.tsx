import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, XCircle, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { notifyEmployee, NotificationTemplates, formatDateForNotification } from "@/lib/notifications";
import ApprovalReasonDialog from "@/components/ApprovalReasonDialog";

const Overtime = () => {
  const [overtimeRequests, setOvertimeRequests] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const { userRole } = useAuth();
  const { toast } = useToast();
  const isAdmin = userRole === 'admin';
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState<"approve" | "reject">("approve");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  // Pagination
  const totalPages = Math.ceil(overtimeRequests.length / itemsPerPage);
  const paginatedRequests = overtimeRequests.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    fetchOvertimeRequests();

    // Real-time listener for overtime requests
    const channel = supabase
      .channel("realtime:overtime_requests")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "overtime_requests" },
        (payload) => {
          console.log("Overtime request change:", payload);
          fetchOvertimeRequests();
          
          if (payload.eventType === "INSERT") {
            toast({
              title: "Pengajuan Lembur Baru",
              description: "Ada permintaan lembur baru masuk",
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchOvertimeRequests = async () => {
    console.log("Fetching overtime requests...");
    
    // Fetch overtime requests first
    const { data: overtimeData, error: overtimeError } = await supabase
      .from('overtime_requests')
      .select("*")
      .order('created_at', { ascending: false });

    if (overtimeError) {
      console.error("Error fetching overtime requests:", overtimeError);
      toast({
        title: "Gagal Memuat Data",
        description: overtimeError.message,
        variant: "destructive",
      });
      return;
    }

    if (!overtimeData || overtimeData.length === 0) {
      setOvertimeRequests([]);
      return;
    }

    // Get unique user IDs
    const userIds = [...new Set(overtimeData.map(r => r.user_id))];
    
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

    // Combine overtime requests with profiles
    const combinedData = overtimeData.map(request => ({
      ...request,
      profiles: profilesMap.get(request.user_id) || null
    }));

    console.log("Overtime requests fetched:", combinedData);
    setOvertimeRequests(combinedData);
  };

  const openApprovalDialog = (requestId: string, action: "approve" | "reject") => {
    setSelectedRequestId(requestId);
    setDialogAction(action);
    setDialogOpen(true);
  };

  const handleApprove = async (reason: string) => {
    if (!selectedRequestId) return;
    
    const request = overtimeRequests.find(r => r.id === selectedRequestId);
    
    // Use secure RPC function instead of direct update
    const { error } = await supabase.rpc('approve_overtime_request', {
      request_id: selectedRequestId,
      notes: reason || null,
    });

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
        description: "Permintaan lembur telah disetujui",
      });
      
      if (request) {
        const date = formatDateForNotification(request.overtime_date);
        const notification = NotificationTemplates.overtimeRequestApproved(date, request.hours);
        notifyEmployee(request.user_id, notification.title, notification.body, { type: 'overtime_approved' });
      }
      
      fetchOvertimeRequests();
    }
  };

  const handleReject = async (reason: string) => {
    if (!selectedRequestId) return;
    
    const request = overtimeRequests.find(r => r.id === selectedRequestId);
    
    // Use secure RPC function instead of direct update
    const { error } = await supabase.rpc('reject_overtime_request', {
      request_id: selectedRequestId,
      reason: reason,
    });

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
        description: "Permintaan lembur telah ditolak",
      });
      
      if (request) {
        const date = formatDateForNotification(request.overtime_date);
        const notification = NotificationTemplates.overtimeRequestRejected(date);
        notifyEmployee(request.user_id, notification.title, notification.body, { type: 'overtime_rejected' });
      }
      
      fetchOvertimeRequests();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-primary">Disetujui</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Ditolak</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manajemen Lembur</h1>
          <p className="text-muted-foreground mt-1">
            Kelola permintaan lembur karyawan
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Permintaan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <span className="text-3xl font-bold">{overtimeRequests.length}</span>
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
                  {overtimeRequests.filter(r => r.status === 'pending').length}
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
                  {overtimeRequests.filter(r => r.status === 'approved').length}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Daftar Permintaan Lembur</CardTitle>
            <CardDescription>
              Semua permintaan lembur karyawan
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto max-h-[calc(100vh-400px)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>NIK</TableHead>
                    <TableHead>Departemen</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Jam</TableHead>
                    <TableHead>Alasan</TableHead>
                    <TableHead>Status</TableHead>
                    {isAdmin && <TableHead>Aksi</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRequests.length > 0 ? (
                    paginatedRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium">
                          {request.profiles?.full_name}
                        </TableCell>
                        <TableCell>{request.profiles?.nik}</TableCell>
                        <TableCell>{request.profiles?.departemen}</TableCell>
                        <TableCell>
                          {new Date(request.overtime_date).toLocaleDateString('id-ID')}
                        </TableCell>
                        <TableCell>{request.hours} jam</TableCell>
                        <TableCell className="max-w-xs truncate">{request.reason}</TableCell>
                        <TableCell>{getStatusBadge(request.status)}</TableCell>
                        {isAdmin && (
                          <TableCell>
                            {request.status === 'pending' && (
                              <div className="flex gap-2">
                                <Button 
                                  size="sm" 
                                  onClick={() => openApprovalDialog(request.id, "approve")}
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="destructive"
                                  onClick={() => openApprovalDialog(request.id, "reject")}
                                >
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
                      <TableCell colSpan={isAdmin ? 8 : 7} className="text-center py-8 text-muted-foreground">
                        Belum ada permintaan lembur
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
                  Menampilkan {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, overtimeRequests.length)} dari {overtimeRequests.length} data
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
        title="Permintaan Lembur"
      />
    </DashboardLayout>
  );
};

export default Overtime;
