import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { EmployeeBottomNav } from "@/components/EmployeeBottomNav";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { id } from "date-fns/locale";

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

const RequestHistory = () => {
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [overtimeRequests, setOvertimeRequests] = useState<OvertimeRequest[]>([]);
  const [loading, setLoading] = useState(true);

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
        <div>
          <h1 className="text-2xl font-bold">Riwayat Pengajuan</h1>
          <p className="text-muted-foreground">Riwayat pengajuan cuti dan lembur</p>
        </div>

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
            ) : leaveRequests.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Belum ada pengajuan cuti
                </CardContent>
              </Card>
            ) : (
              leaveRequests.map((request) => (
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
                      {getStatusBadge(request.status)}
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
            ) : overtimeRequests.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Belum ada pengajuan lembur
                </CardContent>
              </Card>
            ) : (
              overtimeRequests.map((request) => (
                <Card key={request.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold">
                          {format(new Date(request.overtime_date), "EEEE, d MMM yyyy", { locale: id })}
                        </h3>
                        <p className="text-sm text-muted-foreground">{request.hours} jam lembur</p>
                      </div>
                      {getStatusBadge(request.status)}
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
