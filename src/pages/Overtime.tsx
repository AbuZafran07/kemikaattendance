import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, XCircle } from "lucide-react";
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

const Overtime = () => {
  const [overtimeRequests, setOvertimeRequests] = useState<any[]>([]);
  const { userRole } = useAuth();
  const { toast } = useToast();
  const isAdmin = userRole === 'admin';

  useEffect(() => {
    fetchOvertimeRequests();
  }, []);

  const fetchOvertimeRequests = async () => {
    const query = supabase
      .from('overtime_requests')
      .select(`
        *,
        profiles!overtime_requests_user_id_fkey(full_name, nik, departemen)
      `)
      .order('created_at', { ascending: false });

    const { data } = await query;
    
    if (data) {
      setOvertimeRequests(data);
    }
  };

  const handleApprove = async (requestId: string) => {
    const { error } = await supabase
      .from('overtime_requests')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString()
      })
      .eq('id', requestId);

    if (error) {
      toast({
        title: "Gagal Menyetujui",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Berhasil",
        description: "Permintaan lembur telah disetujui",
      });
      fetchOvertimeRequests();
    }
  };

  const handleReject = async (requestId: string) => {
    const { error } = await supabase
      .from('overtime_requests')
      .update({
        status: 'rejected'
      })
      .eq('id', requestId);

    if (error) {
      toast({
        title: "Gagal Menolak",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Berhasil",
        description: "Permintaan lembur telah ditolak",
      });
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
            <div className="overflow-x-auto">
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
                  {overtimeRequests.length > 0 ? (
                    overtimeRequests.map((request) => (
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
                                  onClick={() => handleApprove(request.id)}
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="destructive"
                                  onClick={() => handleReject(request.id)}
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
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Overtime;
