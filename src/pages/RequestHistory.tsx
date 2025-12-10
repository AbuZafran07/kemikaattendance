import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, Clock, X } from "lucide-react";
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

interface LeaveRequest {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  status: string;
  created_at: string;
}

interface OvertimeRequest {
  id: string;
  overtime_date: string;
  hours: number;
  reason: string;
  status: string;
  created_at: string;
}

type StatusFilter = "all" | "pending" | "approved" | "rejected";

const RequestHistory = () => {
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [overtimeRequests, setOvertimeRequests] = useState<OvertimeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.id) {
      fetchRequests();
    }
  }, [profile?.id]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const [leaveRes, overtimeRes] = await Promise.all([
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
      ]);

      if (leaveRes.data) setLeaveRequests(leaveRes.data);
      if (overtimeRes.data) setOvertimeRequests(overtimeRes.data);
    } catch (error) {
      console.error("Error fetching requests:", error);
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
      console.error("Error cancelling leave request:", error);
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
      console.error("Error cancelling overtime request:", error);
      toast.error("Gagal membatalkan pengajuan");
    } finally {
      setCancellingId(null);
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
            <p className="text-muted-foreground">Riwayat pengajuan cuti dan lembur</p>
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
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="leave" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Cuti
            </TabsTrigger>
            <TabsTrigger value="overtime" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Lembur
            </TabsTrigger>
          </TabsList>

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
                      <div className="flex items-center gap-2">
                        {getStatusBadge(request.status)}
                        {request.status === "pending" && (
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
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{request.reason}</p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{request.total_days} hari</span>
                      <span>Diajukan: {format(new Date(request.created_at), "d MMM yyyy", { locale: id })}</span>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

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
                      <div className="flex items-center gap-2">
                        {getStatusBadge(request.status)}
                        {request.status === "pending" && (
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
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{request.reason}</p>
                    <div className="text-xs text-muted-foreground">
                      Diajukan: {format(new Date(request.created_at), "d MMM yyyy", { locale: id })}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      <EmployeeBottomNav />
    </div>
  );
};

export default RequestHistory;
