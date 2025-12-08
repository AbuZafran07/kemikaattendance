import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface LeaveRequest {
  id: string;
  start_date: string;
  end_date: string;
  leave_type: string;
  total_days: number;
  profiles?: {
    full_name: string;
  };
}

interface OvertimeRequest {
  id: string;
  overtime_date: string;
  hours: number;
  reason: string;
  profiles?: {
    full_name: string;
  };
}

interface PendingRequestsProps {
  leaveRequests: LeaveRequest[];
  overtimeRequests: OvertimeRequest[];
}

const PendingRequests = ({ leaveRequests, overtimeRequests }: PendingRequestsProps) => {
  const formatLeaveType = (type: string) => {
    const types: Record<string, string> = {
      cuti_tahunan: "Cuti Tahunan",
      izin: "Izin",
      sakit: "Sakit",
      lupa_absen: "Lupa Absen",
    };
    return types[type] || type;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Permintaan Pending</CardTitle>
        <CardDescription>Menunggu approval HRGA</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="leave" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="leave" className="text-xs">
              Cuti ({leaveRequests.length})
            </TabsTrigger>
            <TabsTrigger value="overtime" className="text-xs">
              Lembur ({overtimeRequests.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="leave" className="mt-4">
            <div className="space-y-4 max-h-[400px] overflow-y-auto pb-2">
              {leaveRequests.length > 0 ? (
                leaveRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-3 border border-border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-primary/10">
                        <CalendarDays className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{request.profiles?.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(request.start_date).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                          })}{" "}
                          -{" "}
                          {new Date(request.end_date).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" className="text-xs">
                        {formatLeaveType(request.leave_type)}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">{request.total_days} hari</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-4 text-sm">Tidak ada permintaan cuti pending</p>
              )}
            </div>
          </TabsContent>
          <TabsContent value="overtime" className="mt-4">
            <div className="space-y-3 max-h-[250px] overflow-y-auto">
              {overtimeRequests.length > 0 ? (
                overtimeRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-3 border border-border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-secondary/10">
                        <Clock className="h-4 w-4 text-secondary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{request.profiles?.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(request.overtime_date).toLocaleDateString("id-ID", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="text-xs">
                        {request.hours} jam
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-4 text-sm">Tidak ada permintaan lembur pending</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default PendingRequests;
