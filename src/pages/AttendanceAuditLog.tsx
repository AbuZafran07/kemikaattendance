import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { ArrowLeft, Search, FileText, Pencil, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface AuditLog {
  id: string;
  attendance_id: string;
  action_type: string;
  changed_by: string;
  old_data: Record<string, unknown>;
  new_data: Record<string, unknown> | null;
  reason: string | null;
  created_at: string;
  admin_name?: string;
  employee_name?: string;
}

const ITEMS_PER_PAGE = 10;

const AttendanceAuditLog = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("attendance_audit_logs")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (data) {
        // Fetch admin and employee names
        const changedByIds = [...new Set(data.map((l) => l.changed_by))];
        const employeeIds = [...new Set(data.map((l) => {
          const old = l.old_data as Record<string, unknown>;
          return old?.user_id as string;
        }).filter(Boolean))];

        const allIds = [...new Set([...changedByIds, ...employeeIds])];

        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", allIds);

        const profileMap = new Map(profiles?.map((p) => [p.id, p.full_name]) || []);

        const enriched: AuditLog[] = data.map((log) => {
          const old = log.old_data as Record<string, unknown>;
          return {
            ...log,
            old_data: old,
            new_data: log.new_data as Record<string, unknown> | null,
            admin_name: profileMap.get(log.changed_by) || "Unknown",
            employee_name: profileMap.get(old?.user_id as string) || "Unknown",
          };
        });

        setLogs(enriched);
      }
    } catch (error) {
      console.error("Error fetching audit logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    const term = searchTerm.toLowerCase();
    return (
      log.admin_name?.toLowerCase().includes(term) ||
      log.employee_name?.toLowerCase().includes(term) ||
      log.action_type.toLowerCase().includes(term) ||
      log.reason?.toLowerCase().includes(term)
    );
  });

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const formatTime = (timeStr: unknown) => {
    if (!timeStr || typeof timeStr !== "string") return "-";
    try {
      return format(new Date(timeStr), "dd MMM yyyy HH:mm", { locale: id });
    } catch {
      return String(timeStr);
    }
  };

  const getActionBadge = (actionType: string) => {
    switch (actionType) {
      case "edit":
        return (
          <Badge variant="outline" className="gap-1">
            <Pencil className="h-3 w-3" />
            Edit
          </Badge>
        );
      case "delete":
        return (
          <Badge variant="destructive" className="gap-1">
            <Trash2 className="h-3 w-3" />
            Hapus
          </Badge>
        );
      default:
        return <Badge variant="secondary">{actionType}</Badge>;
    }
  };

  const renderChanges = (log: AuditLog) => {
    if (log.action_type === "delete") {
      return (
        <div className="text-sm text-muted-foreground">
          <p>Check-in: {formatTime(log.old_data?.check_in_time)}</p>
          <p>Check-out: {formatTime(log.old_data?.check_out_time)}</p>
        </div>
      );
    }

    if (log.action_type === "edit" && log.new_data) {
      const changes: string[] = [];
      if (log.old_data?.check_in_time !== log.new_data?.check_in_time) {
        changes.push(`Check-in: ${formatTime(log.old_data?.check_in_time)} → ${formatTime(log.new_data?.check_in_time)}`);
      }
      if (log.old_data?.check_out_time !== log.new_data?.check_out_time) {
        changes.push(`Check-out: ${formatTime(log.old_data?.check_out_time)} → ${formatTime(log.new_data?.check_out_time)}`);
      }
      if (log.old_data?.duration_minutes !== log.new_data?.duration_minutes) {
        changes.push(`Durasi: ${log.old_data?.duration_minutes ?? "-"} → ${log.new_data?.duration_minutes ?? "-"} menit`);
      }
      return (
        <div className="text-sm text-muted-foreground space-y-0.5">
          {changes.map((c, i) => (
            <p key={i}>{c}</p>
          ))}
        </div>
      );
    }

    return <span className="text-sm text-muted-foreground">-</span>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/attendance")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6" />
              Audit Log Absensi
            </h1>
            <p className="text-muted-foreground text-sm">Riwayat perubahan data absensi oleh admin</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Log Perubahan</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari admin, karyawan..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Memuat data...</div>
            ) : paginatedLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Belum ada log perubahan</div>
            ) : (
              <>
                <div className="rounded-md border overflow-auto max-h-[60vh]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Waktu</TableHead>
                        <TableHead>Aksi</TableHead>
                        <TableHead>Admin</TableHead>
                        <TableHead>Karyawan</TableHead>
                        <TableHead>Perubahan</TableHead>
                        <TableHead>Alasan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="whitespace-nowrap text-sm">
                            {formatTime(log.created_at)}
                          </TableCell>
                          <TableCell>{getActionBadge(log.action_type)}</TableCell>
                          <TableCell className="text-sm font-medium">{log.admin_name}</TableCell>
                          <TableCell className="text-sm">{log.employee_name}</TableCell>
                          <TableCell>{renderChanges(log)}</TableCell>
                          <TableCell className="text-sm max-w-[200px] truncate">
                            {log.reason || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      Halaman {currentPage} dari {totalPages} ({filteredLogs.length} log)
                    </p>
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                        <PaginationItem>
                          <PaginationLink isActive>{currentPage}</PaginationLink>
                        </PaginationItem>
                        <PaginationItem>
                          <PaginationNext
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AttendanceAuditLog;
