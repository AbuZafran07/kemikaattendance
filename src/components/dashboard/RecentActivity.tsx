import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmployeeAvatar } from "@/components/ui/employee-avatar";

interface AttendanceRecord {
  id: string;
  check_in_time: string;
  check_out_time?: string;
  status: string;
  profiles?: {
    full_name: string;
    departemen: string;
    photo_url?: string;
  };
}

interface RecentActivityProps {
  data: AttendanceRecord[];
}

const RecentActivity = ({ data }: RecentActivityProps) => {
  const formatStatus = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      hadir: { label: "Tepat Waktu", variant: "default" },
      terlambat: { label: "Terlambat", variant: "secondary" },
      pulang_cepat: { label: "Pulang Cepat", variant: "outline" },
      tidak_hadir: { label: "Tidak Hadir", variant: "destructive" },
    };
    return statusMap[status] || { label: status, variant: "outline" as const };
  };

  // Cek apakah tanggal check_in adalah hari ini
  const isToday = (dateString: string) => {
    const d = new Date(dateString);
    const today = new Date();

    return (
      d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()
    );
  };

  // Filter hanya record absensi hari ini
  const todayRecords = data.filter((record) => isToday(record.check_in_time));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Aktivitas Terbaru</CardTitle>
        <CardDescription>Absensi real-time hari ini</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 max-h-[400px] overflow-y-auto pb-2">
          {todayRecords.length > 0 ? (
            todayRecords.map((record) => {
              const status = formatStatus(record.status);
              return (
                <div
                  key={record.id}
                  className="flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <EmployeeAvatar
                    src={record.profiles?.photo_url}
                    name={record.profiles?.full_name}
                    fallbackClassName="bg-primary/10 text-primary"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{record.profiles?.full_name}</p>
                    <p className="text-xs text-muted-foreground">{record.profiles?.departemen}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant={status.variant} className="mb-1">
                      {status.label}
                    </Badge>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(record.check_in_time).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {record.check_out_time && (
                        <span>
                          {" - "}
                          {new Date(record.check_out_time).toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-center text-muted-foreground py-8">Belum ada aktivitas hari ini</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default RecentActivity;
