import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, CheckCircle2, XCircle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import ApprovalReasonDialog from "@/components/ApprovalReasonDialog";
import logger from "@/lib/logger";

interface LateReasonRow {
  id: string;
  attendance_id: string;
  user_id: string;
  reason: string;
  description: string | null;
  status: string;
  submitted_at: string;
  rejection_reason: string | null;
  profile?: { full_name: string; departemen: string | null; photo_url: string | null } | null;
  attendance?: { check_in_time: string; late_minutes: number | null } | null;
}

const statusLabel: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Menunggu", variant: "secondary" },
  approved: { label: "Disetujui", variant: "default" },
  rejected: { label: "Ditolak", variant: "destructive" },
  no_reason_submitted: { label: "Tidak Diajukan", variant: "destructive" },
};

const LateReasonApproval = () => {
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const { toast } = useToast();
  const isAdmin = userRole === "admin" || userRole === "hr";

  const [rows, setRows] = useState<LateReasonRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState("pending");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState<"approve" | "reject">("approve");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    fetchLateReasons();

    const channel = supabase
      .channel("realtime:late_reasons")
      .on("postgres_changes", { event: "*", schema: "public", table: "late_reasons" }, () => {
        fetchLateReasons();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchLateReasons = async () => {
    setIsLoading(true);
    try {
      const { data: lateReasons, error } = await supabase
        .from("late_reasons")
        .select("*")
        .order("submitted_at", { ascending: false });

      if (error) throw error;
      if (!lateReasons || lateReasons.length === 0) {
        setRows([]);
        return;
      }

      const userIds = [...new Set(lateReasons.map((r) => r.user_id))];
      const attendanceIds = [...new Set(lateReasons.map((r) => r.attendance_id))];

      const [{ data: profiles }, { data: attendances }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, departemen, photo_url").in("id", userIds),
        supabase.from("attendance").select("id, check_in_time, late_minutes").in("id", attendanceIds),
      ]);

      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
      const attendanceMap = new Map((attendances || []).map((a) => [a.id, a]));

      setRows(
        lateReasons.map((r) => ({
          ...r,
          profile: profileMap.get(r.user_id) || null,
          attendance: attendanceMap.get(r.attendance_id) || null,
        }))
      );
    } catch (error) {
      logger.error("Error fetching late reasons:", error);
      toast({
        title: "Gagal Memuat Data",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const openDialog = (id: string, action: "approve" | "reject") => {
    setSelectedId(id);
    setDialogAction(action);
    setDialogOpen(true);
  };

  const handleApprove = async (notes: string) => {
    if (!selectedId) return;
    const { error } = await supabase.rpc("approve_late_reason", { reason_id: selectedId, notes: notes || null });
    if (error) {
      toast({ title: "Gagal Menyetujui", description: error.message, variant: "destructive" });
      throw error;
    }
    toast({ title: "Berhasil", description: "Alasan keterlambatan disetujui." });
    fetchLateReasons();
  };

  const handleReject = async (reason: string) => {
    if (!selectedId) return;
    const { error } = await supabase.rpc("reject_late_reason", { reason_id: selectedId, reason });
    if (error) {
      toast({ title: "Gagal Menolak", description: error.message, variant: "destructive" });
      throw error;
    }
    toast({ title: "Berhasil", description: "Alasan keterlambatan ditolak, dicatat sebagai pelanggaran." });
    fetchLateReasons();
  };

  const filteredRows = rows.filter((r) => (tab === "all" ? true : r.status === tab));
  const pendingCount = rows.filter((r) => r.status === "pending").length;

  const getInitials = (name?: string) =>
    (name || "?")
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/attendance")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Persetujuan Alasan Terlambat</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Tinjau dan setujui/tolak alasan keterlambatan karyawan. Alasan yang ditolak otomatis tercatat sebagai pelanggaran disiplin.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Daftar Alasan Terlambat</CardTitle>
            <CardDescription>{pendingCount} menunggu persetujuan</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="pending">Menunggu</TabsTrigger>
                <TabsTrigger value="approved">Disetujui</TabsTrigger>
                <TabsTrigger value="rejected">Ditolak</TabsTrigger>
                <TabsTrigger value="all">Semua</TabsTrigger>
              </TabsList>
              <TabsContent value={tab} className="mt-4">
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Memuat data...</div>
                ) : filteredRows.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">Tidak ada data</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Karyawan</TableHead>
                          <TableHead>Tanggal &amp; Waktu</TableHead>
                          <TableHead>Alasan</TableHead>
                          <TableHead>Status</TableHead>
                          {isAdmin && <TableHead className="text-right">Aksi</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={row.profile?.photo_url || undefined} />
                                  <AvatarFallback>{getInitials(row.profile?.full_name)}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-sm font-medium">{row.profile?.full_name || "Unknown"}</p>
                                  <p className="text-xs text-muted-foreground">{row.profile?.departemen || "-"}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-sm">
                                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                {row.attendance?.check_in_time
                                  ? new Date(row.attendance.check_in_time).toLocaleString("id-ID", {
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : "-"}
                              </div>
                              {row.attendance?.late_minutes ? (
                                <p className="text-xs text-muted-foreground">Terlambat {row.attendance.late_minutes} menit</p>
                              ) : null}
                            </TableCell>
                            <TableCell className="max-w-xs">
                              <p className="text-sm">{row.reason}</p>
                              {row.status === "rejected" && row.rejection_reason && (
                                <p className="text-xs text-destructive mt-1">Alasan tolak: {row.rejection_reason}</p>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusLabel[row.status]?.variant || "outline"}>
                                {statusLabel[row.status]?.label || row.status}
                              </Badge>
                            </TableCell>
                            {isAdmin && (
                              <TableCell className="text-right">
                                {row.status === "pending" ? (
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0 text-primary"
                                      onClick={() => openDialog(row.id, "approve")}
                                    >
                                      <CheckCircle2 className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0 text-destructive"
                                      onClick={() => openDialog(row.id, "reject")}
                                    >
                                      <XCircle className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <ApprovalReasonDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        action={dialogAction}
        title="Alasan Keterlambatan"
        onConfirm={dialogAction === "approve" ? handleApprove : handleReject}
      />
    </DashboardLayout>
  );
};

export default LateReasonApproval;
