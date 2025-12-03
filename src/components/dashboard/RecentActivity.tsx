import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCheck, LogOut, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AttendanceRecord {
  id: string;
  check_in_time: string;
  check_out_time?: string;
  status: string;
  profiles?: {
    full_name: string;
    departemen: string;
  };
}

interface RecentActivityProps {
  data: AttendanceRecord[];
}

const RecentActivity = ({ data }: RecentActivityProps) => {
  const formatStatus = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      'hadir': { label: 'Tepat Waktu', variant: 'default' },
      'terlambat': { label: 'Terlambat', variant: 'secondary' },
      'pulang_cepat': { label: 'Pulang Cepat', variant: 'outline' },
      'tidak_hadir': { label: 'Tidak Hadir', variant: 'destructive' }
    };
    return statusMap[status] || { label: status, variant: 'outline' as const };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Aktivitas Terbaru</CardTitle>
        <CardDescription>
          Absensi real-time hari ini
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 max-h-[400px] overflow-y-auto">
          {data.length > 0 ? (
            data.map((record) => {
              const status = formatStatus(record.status);
              return (
                <div key={record.id} className="flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                    record.check_out_time ? 'bg-secondary/10' : 'bg-primary/10'
                  }`}>
                    {record.check_out_time ? (
                      <LogOut className="h-5 w-5 text-secondary" />
                    ) : (
                      <UserCheck className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{record.profiles?.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {record.profiles?.departemen}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant={status.variant} className="mb-1">
                      {status.label}
                    </Badge>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(record.check_in_time).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                      {record.check_out_time && (
                        <span>
                          {' - '}
                          {new Date(record.check_out_time).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit'
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
