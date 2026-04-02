import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Search, ShieldCheck } from "lucide-react";
import logger from "@/lib/logger";

interface ApprovalLog {
  id: string;
  request_type: string;
  request_id: string;
  action_type: string;
  performed_by: string;
  target_user_id: string;
  details: Record<string, unknown>;
  notes: string | null;
  created_at: string;
  admin_name?: string;
  employee_name?: string;
}

const ApprovalAuditLog = () => {
  const [logs, setLogs] = useState<ApprovalLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterAction, setFilterAction] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const { data: rawData, error } = await supabase
        .from("approval_audit_logs" as any)
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const data = (rawData || []) as any[];

      if (!data || data.length === 0) {
        setLogs([]);
        return;
      }

      // Get unique user IDs
      const allUserIds = [
        ...new Set([
          ...data.map((l) => l.performed_by),
          ...data.map((l) => l.target_user_id),
        ]),
      ];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", allUserIds);

      const profileMap = new Map((profiles || []).map((p) => [p.id, p.full_name]));

      const enriched: ApprovalLog[] = data.map((log) => ({
        ...log,
        details: (log.details as Record<string, unknown>) || {},
        admin_name: profileMap.get(log.performed_by) || "Unknown",
        employee_name: profileMap.get(log.target_user_id) || "Unknown",
      }));

      setLogs(enriched);
    } catch (err) {
      logger.error("Error fetching approval audit logs:", err);
    } finally {
      setLoading(false);
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case "approved":
        return <Badge className="bg-primary">Disetujui</Badge>;
      case "rejected":
        return <Badge variant="destructive">Ditolak</Badge>;
      case "created_by_admin":
        return <Badge variant="secondary">Dibuat Admin</Badge>;
      default:
        return <Badge variant="outline">{action}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    const map: Record<string, { label: string; className: string }> = {
      leave: { label: "Cuti", className: "bg-blue-500/10 text-blue-700 border-blue-200" },
      overtime: { label: "Lembur", className: "bg-orange-500/10 text-orange-700 border-orange-200" },
      business_travel: { label: "Dinas", className: "bg-purple-500/10 text-purple-700 border-purple-200" },
    };
    const info = map[type] || { label: type, className: "" };
    return <Badge variant="outline" className={info.className}>{info.label}</Badge>;
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      !searchTerm ||
      log.admin_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.employee_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.notes?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || log.request_type === filterType;
    const matchesAction = filterAction === "all" || log.action_type === filterAction;
    return matchesSearch && matchesType && matchesAction;
  });

  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Log Persetujuan</h1>
          <p className="text-muted-foreground mt-1">
            Riwayat lengkap persetujuan, penolakan, dan pembuatan pengajuan oleh admin
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Log</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{logs.length}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Disetujui</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-primary">{logs.filter((l) => l.action_type === "approved").length}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Ditolak</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-destructive">{logs.filter((l) => l.action_type === "rejected").length}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Dibuat Admin</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{logs.filter((l) => l.action_type === "created_by_admin").length}</span>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Riwayat Audit</CardTitle>
            <CardDescription>Log semua aksi persetujuan dan penolakan pengajuan</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari nama admin atau karyawan..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  className="pl-9"
                />
              </div>
              <Select value={filterType} onValueChange={(v) => { setFilterType(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Tipe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Tipe</SelectItem>
                  <SelectItem value="leave">Cuti</SelectItem>
                  <SelectItem value="overtime">Lembur</SelectItem>
                  <SelectItem value="business_travel">Dinas</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterAction} onValueChange={(v) => { setFilterAction(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Aksi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Aksi</SelectItem>
                  <SelectItem value="approved">Disetujui</SelectItem>
                  <SelectItem value="rejected">Ditolak</SelectItem>
                  <SelectItem value="created_by_admin">Dibuat Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Memuat data...</div>
            ) : (
              <>
                <div className="overflow-auto max-h-[calc(100vh-500px)]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Waktu</TableHead>
                        <TableHead>Admin</TableHead>
                        <TableHead>Karyawan</TableHead>
                        <TableHead>Tipe</TableHead>
                        <TableHead>Aksi</TableHead>
                        <TableHead>Catatan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedLogs.length > 0 ? (
                        paginatedLogs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="whitespace-nowrap text-sm">
                              {format(new Date(log.created_at), "dd MMM yyyy HH:mm", { locale: idLocale })}
                            </TableCell>
                            <TableCell className="font-medium">{log.admin_name}</TableCell>
                            <TableCell>{log.employee_name}</TableCell>
                            <TableCell>{getTypeBadge(log.request_type)}</TableCell>
                            <TableCell>{getActionBadge(log.action_type)}</TableCell>
                            <TableCell className="max-w-xs truncate">{log.notes || "-"}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            Belum ada log audit
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <DataTablePagination
                  currentPage={currentPage}
                  totalItems={filteredLogs.length}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={setItemsPerPage}
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ApprovalAuditLog;
