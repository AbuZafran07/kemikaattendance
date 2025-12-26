import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, Clock, X, Pencil, MapPin, Download, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { EmployeeBottomNav } from "@/components/EmployeeBottomNav";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { EditLeaveRequestDialog } from "@/components/EditLeaveRequestDialog";
import { EditOvertimeRequestDialog } from "@/components/EditOvertimeRequestDialog";
import { EditBusinessTravelDialog } from "@/components/EditBusinessTravelDialog";
import logger from "@/lib/logger";

interface LeaveRequest {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  status: string;
  created_at: string;
  approval_notes: string | null;
  rejection_reason: string | null;
}

interface OvertimeRequest {
  id: string;
  overtime_date: string;
  hours: number;
  reason: string;
  status: string;
  created_at: string;
  approval_notes: string | null;
  rejection_reason: string | null;
}

interface BusinessTravelRequest {
  id: string;
  destination: string;
  purpose: string;
  start_date: string;
  end_date: string;
  total_days: number;
  notes: string | null;
  status: string;
  document_url: string | null;
  created_at: string;
  rejection_reason: string | null;
}

type StatusFilter = "all" | "pending" | "approved" | "rejected";

const RequestHistory = () => {
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [overtimeRequests, setOvertimeRequests] = useState<OvertimeRequest[]>([]);
  const [businessTravelRequests, setBusinessTravelRequests] = useState<BusinessTravelRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [editLeaveRequest, setEditLeaveRequest] = useState<LeaveRequest | null>(null);
  const [editOvertimeRequest, setEditOvertimeRequest] = useState<OvertimeRequest | null>(null);
  const [editBusinessTravelRequest, setEditBusinessTravelRequest] = useState<BusinessTravelRequest | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.id) {
      fetchRequests();
    }
  }, [profile?.id]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const [leaveRes, overtimeRes, businessTravelRes] = await Promise.all([
        supabase
          .from("leave_requests")
          .select("*")
          .eq("user_id", profile?.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("overtime_requests")
          .select("*")
          .eq("user_id", profile?.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("business_travel_requests")
          .select("*")
          .eq("user_id", profile?.id)
          .order("created_at", { ascending: false }),
      ]);

      if (leaveRes.data) setLeaveRequests(leaveRes.data);
      if (overtimeRes.data) setOvertimeRequests(overtimeRes.data);
      if (businessTravelRes.data) setBusinessTravelRequests(businessTravelRes.data);
    } catch (error) {
      logger.error("Error fetching requests:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelLeave = async (id: string) => {
    setCancellingId(id);
    try {
      const { error } = await supabase
        .from("leave_requests")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setLeaveRequests((prev) => prev.filter((r) => r.id !== id));
      toast.success("Pengajuan cuti berhasil dibatalkan");
    } catch (error) {
      logger.error("Error cancelling leave request:", error);
      toast.error("Gagal membatalkan pengajuan");
    } finally {
      setCancellingId(null);
    }
  };

  const handleCancelOvertime = async (id: string) => {
    setCancellingId(id);
    try {
      const { error } = await supabase
        .from("overtime_requests")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setOvertimeRequests((prev) => prev.filter((r) => r.id !== id));
      toast.success("Pengajuan lembur berhasil dibatalkan");
    } catch (error) {
      logger.error("Error cancelling overtime request:", error);
      toast.error("Gagal membatalkan pengajuan");
    } finally {
      setCancellingId(null);
    }
  };

  const handleCancelBusinessTravel = async (id: string) => {
    setCancellingId(id);
    try {
      const { error } = await supabase
        .from("business_travel_requests")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setBusinessTravelRequests((prev) => prev.filter((r) => r.id !== id));
      toast.success("Pengajuan perjalanan dinas berhasil dibatalkan");
    } catch (error) {
      logger.error("Error cancelling business travel request:", error);
      toast.error("Gagal membatalkan pengajuan");
    } finally {
      setCancellingId(null);
    }
  };

  const handleDownloadDocument = async (request: BusinessTravelRequest) => {
    if (!request.document_url) {
      toast.error("Dokumen belum tersedia");
      return;
    }

    setDownloadingId(request.id);
    try {
      const path = request.document_url.includes('business-travel-docs/') 
        ? request.document_url.split('business-travel-docs/')[1]
        : request.document_url;

      const { data, error } = await supabase.storage
        .from("business-travel-docs")
        .download(path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Surat_Dinas_${request.destination.replace(/\s+/g, '_')}_${format(new Date(request.start_date), 'dd-MM-yyyy')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Dokumen berhasil diunduh");
    } catch (error) {
      logger.error("Error downloading document:", error);
      toast.error("Gagal mengunduh dokumen");
    } finally {
      setDownloadingId(null);
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20">Disetujui</Badge>;
      case "rejected":
        return <Badge variant="destructive">Ditolak</Badge>;
      default:
        return <Badge variant="secondary">Menunggu</Badge>;
    }
  };

  const filterByStatus = <T extends { status: string }>(items: T[]): T[] => {
    if (statusFilter === "all") return items;
    return items.filter((item) => item.status === statusFilter);
  };

  const filteredLeaveRequests = filterByStatus(leaveRequests);
  const filteredOvertimeRequests = filterByStatus(overtimeRequests);
  const filteredBusinessTravelRequests = filterByStatus(businessTravelRequests);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/10 pb-24">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/employee")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <img src={logo} alt="Kemika" className="h-8 object-contain" />
          </div>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-lg space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Riwayat Pengajuan</h1>
            <p className="text-muted-foreground">Riwayat pengajuan cuti, lembur, dan perjalanan dinas</p>
          </div>
        </div>

        {/* Status Filter */}
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Filter Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="pending">Menunggu</SelectItem>
            <SelectItem value="approved">Disetujui</SelectItem>
            <SelectItem value="rejected">Ditolak</SelectItem>
          </SelectContent>
        </Select>

        <Tabs defaultValue="leave" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="leave" className="flex items-center gap-1 text-xs">
              <Calendar className="h-3 w-3" />
              Cuti
            </TabsTrigger>
            <TabsTrigger value="overtime" className="flex items-center gap-1 text-xs">
              <Clock className="h-3 w-3" />
              Lembur
            </TabsTrigger>
            <TabsTrigger value="travel" className="flex items-center gap-1 text-xs">
              <MapPin className="h-3 w-3" />
              Dinas
            </TabsTrigger>
          </TabsList>

          {/* Leave Requests Tab */}
          <TabsContent value="leave" className="mt-4 space-y-3">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Memuat...</div>
            ) : filteredLeaveRequests.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  {statusFilter === "all" ? "Belum ada pengajuan cuti" : "Tidak ada pengajuan dengan status ini"}
                </CardContent>
              </Card>
            ) : (
              filteredLeaveRequests.map((request) => (
                <Card key={request.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold">{formatLeaveType(request.leave_type)}</h3>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(request.start_date), "d MMM yyyy", { locale: id })}
                          {request.start_date !== request.end_date &&
                            ` - ${format(new Date(request.end_date), "d MMM yyyy", { locale: id })}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {getStatusBadge(request.status)}
                        {request.status === "pending" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setEditLeaveRequest(request)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  disabled={cancellingId === request.id}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Batalkan Pengajuan?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Apakah Anda yakin ingin membatalkan pengajuan cuti ini? Tindakan ini tidak dapat dibatalkan.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Tidak</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleCancelLeave(request.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Ya, Batalkan
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{request.reason}</p>
                    {/* Show approval notes or rejection reason */}
                    {request.status === "approved" && request.approval_notes && (
                      <p className="text-sm text-green-600 mb-2 italic">
                        Catatan Persetujuan: {request.approval_notes}
                      </p>
                    )}
                    {request.status === "rejected" && request.rejection_reason && (
                      <p className="text-sm text-destructive mb-2 italic">
                        Alasan Penolakan: {request.rejection_reason}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{request.total_days} hari</span>
                      <span>Diajukan: {format(new Date(request.created_at), "d MMM yyyy", { locale: id })}</span>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Overtime Requests Tab */}
          <TabsContent value="overtime" className="mt-4 space-y-3">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Memuat...</div>
            ) : filteredOvertimeRequests.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  {statusFilter === "all" ? "Belum ada pengajuan lembur" : "Tidak ada pengajuan dengan status ini"}
                </CardContent>
              </Card>
            ) : (
              filteredOvertimeRequests.map((request) => (
                <Card key={request.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold">
                          {format(new Date(request.overtime_date), "EEEE, d MMM yyyy", { locale: id })}
                        </h3>
                        <p className="text-sm text-muted-foreground">{request.hours} jam lembur</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {getStatusBadge(request.status)}
                        {request.status === "pending" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setEditOvertimeRequest(request)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  disabled={cancellingId === request.id}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Batalkan Pengajuan?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Apakah Anda yakin ingin membatalkan pengajuan lembur ini? Tindakan ini tidak dapat dibatalkan.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Tidak</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleCancelOvertime(request.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Ya, Batalkan
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{request.reason}</p>
                    {/* Show approval notes or rejection reason */}
                    {request.status === "approved" && request.approval_notes && (
                      <p className="text-sm text-green-600 mb-2 italic">
                        Catatan Persetujuan: {request.approval_notes}
                      </p>
                    )}
                    {request.status === "rejected" && request.rejection_reason && (
                      <p className="text-sm text-destructive mb-2 italic">
                        Alasan Penolakan: {request.rejection_reason}
                      </p>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Diajukan: {format(new Date(request.created_at), "d MMM yyyy", { locale: id })}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Business Travel Requests Tab */}
          <TabsContent value="travel" className="mt-4 space-y-3">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Memuat...</div>
            ) : filteredBusinessTravelRequests.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  {statusFilter === "all" ? "Belum ada pengajuan perjalanan dinas" : "Tidak ada pengajuan dengan status ini"}
                </CardContent>
              </Card>
            ) : (
              filteredBusinessTravelRequests.map((request) => (
                <Card key={request.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-primary" />
                          <h3 className="font-semibold">{request.destination}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {format(new Date(request.start_date), "d MMM yyyy", { locale: id })}
                          {request.start_date !== request.end_date &&
                            ` - ${format(new Date(request.end_date), "d MMM yyyy", { locale: id })}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {getStatusBadge(request.status)}
                        {request.status === "pending" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setEditBusinessTravelRequest(request)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  disabled={cancellingId === request.id}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Batalkan Pengajuan?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Apakah Anda yakin ingin membatalkan pengajuan perjalanan dinas ini? Tindakan ini tidak dapat dibatalkan.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Tidak</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleCancelBusinessTravel(request.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Ya, Batalkan
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <p className="text-sm mb-2">{request.purpose}</p>
                    {request.notes && (
                      <p className="text-sm text-muted-foreground mb-2">Catatan: {request.notes}</p>
                    )}
                    {/* Show rejection reason */}
                    {request.status === "rejected" && request.rejection_reason && (
                      <p className="text-sm text-destructive mb-2 italic">
                        Alasan Penolakan: {request.rejection_reason}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{request.total_days} hari</span>
                      <span>Diajukan: {format(new Date(request.created_at), "d MMM yyyy", { locale: id })}</span>
                    </div>

                    {/* Download Document Button */}
                    {request.status === "approved" && request.document_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-3"
                        onClick={() => handleDownloadDocument(request)}
                        disabled={downloadingId === request.id}
                      >
                        {downloadingId === request.id ? (
                          "Mengunduh..."
                        ) : (
                          <>
                            <Download className="h-4 w-4 mr-2" />
                            Unduh Surat Dinas
                          </>
                        )}
                      </Button>
                    )}

                    {request.status === "approved" && !request.document_url && (
                      <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground bg-muted p-2 rounded">
                        <FileText className="h-4 w-4" />
                        <span>Surat dinas sedang diproses oleh admin</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Dialogs */}
      {editLeaveRequest && (
        <EditLeaveRequestDialog
          open={!!editLeaveRequest}
          onOpenChange={(open) => !open && setEditLeaveRequest(null)}
          request={editLeaveRequest}
          onUpdated={fetchRequests}
        />
      )}

      {editOvertimeRequest && (
        <EditOvertimeRequestDialog
          open={!!editOvertimeRequest}
          onOpenChange={(open) => !open && setEditOvertimeRequest(null)}
          request={editOvertimeRequest}
          onUpdated={fetchRequests}
        />
      )}

      {editBusinessTravelRequest && (
        <EditBusinessTravelDialog
          open={!!editBusinessTravelRequest}
          onOpenChange={(open) => !open && setEditBusinessTravelRequest(null)}
          request={editBusinessTravelRequest}
          onUpdated={fetchRequests}
        />
      )}

      <EmployeeBottomNav />
    </div>
  );
};

export default RequestHistory;
