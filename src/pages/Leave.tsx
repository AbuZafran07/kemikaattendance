import DashboardLayout from "@/components/DashboardLayout";
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
    const { data, error } = await supabase
      .from("leave_requests")
      .select(`
        *,
        profiles:user_id(full_name, nik, departemen)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Gagal memuat data",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setLeaveRequests(data || []);
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
        description: "Permintaan cuti telah disetujui.",
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
        description: "Permintaan cuti telah ditolak.",
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
      i
