import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmployeeAvatar } from "@/components/ui/employee-avatar";
import { Clock, Calendar, CheckCircle2, MapPin, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Helper to get signed URL for employee photos
const getSignedPhotoUrl = async (filePath: string | null): Promise<string | null> => {
  if (!filePath) return null;

  let path = filePath;
  if (filePath.startsWith("http")) {
    const match = filePath.match(/employee-photos\/(.+)$/);
    if (match) {
      path = match[1];
    } else {
      return filePath;
    }
  }

  const { data, error } = await supabase.storage.from("employee-photos").createSignedUrl(path, 3600);

  if (error) {
    console.error("Error creating signed URL:", error);
    return null;
  }

  return data.signedUrl;
};

interface AttendanceNotification {
  id: string;
  user_id: string;
  check_in_time: string;
  check_out_time: string | null;
  status: string;
  profiles: {
    full_name: string;
    nik: string;
    departemen: string;
    photo_url?: string;
  };
  notes: string | null;
  created_at: string;
}

interface RequestNotification {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
  profiles: {
    full_name: string;
    nik: string;
    departemen: string;
    photo_url?: string;
  };
  type?: "leave" | "overtime";
}

const Notifications = () => {
  const [attendanceNotifications, setAttendanceNotifications] = useState<AttendanceNotification[]>([]);
  const [leaveNotifications, setLeaveNotifications] = useState<RequestNotification[]>([]);
  const [overtimeNotifications, setOvertimeNotifications] = useState<RequestNotification[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchAllNotifications();
    setupRealtimeSubscriptions();
  }, []);

  const fetchAllNotifications = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchAttendance(), fetchLeaveRequests(), fetchOvertimeRequests()]);
    setIsRefreshing(false);
  };

  const fetchAttendance = async () => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    // First try to get today's data
    let { data: attendanceData } = await supabase
      .from("attendance")
      .select("*")
      .gte("created_at", startOfToday.toISOString())
      .lte("created_at", endOfToday.toISOString())
      .order("check_in_time", { ascending: false });

    // If no today's data, get last 7 days
    if (!attendanceData || attendanceData.length === 0) {
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: recentData } = await supabase
        .from("attendance")
        .select("*")
        .gte("created_at", sevenDaysAgo.toISOString())
        .order("check_in_time", { ascending: false })
        .limit(20);

      attendanceData = recentData;
    }

    if (!attendanceData || attendanceData.length === 0) {
      setAttendanceNotifications([]);
      return;
    }

    // Fetch profiles for user IDs
    const userIds = [...new Set(attendanceData.map((a) => a.user_id))];
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, full_name, nik, departemen, photo_url")
      .in("id", userIds);

    // Generate signed URLs for photos
    const profilesWithSignedUrls = await Promise.all(
      (profilesData || []).map(async (p) => {
        const signedUrl = await getSignedPhotoUrl(p.photo_url);
        return { ...p, photo_url: signedUrl };
      }),
    );

    const profilesMap = new Map(
      profilesWithSignedUrls.map((p) => [
        p.id,
        { full_name: p.full_name, nik: p.nik, departemen: p.departemen, photo_url: p.photo_url },
      ]),
    );

    const combinedData = attendanceData.map((record) => ({
      ...record,
      profiles: profilesMap.get(record.user_id) || { full_name: "Unknown", nik: "-", departemen: "-" },
    }));

    setAttendanceNotifications(combinedData as any);
  };

  const fetchLeaveRequests = async () => {
    const { data: leaveData } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (!leaveData || leaveData.length === 0) {
      setLeaveNotifications([]);
      return;
    }

    const userIds = [...new Set(leaveData.map((l) => l.user_id))];
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, full_name, nik, departemen, photo_url")
      .in("id", userIds);

    // Generate signed URLs for photos
    const profilesWithSignedUrls = await Promise.all(
      (profilesData || []).map(async (p) => {
        const signedUrl = await getSignedPhotoUrl(p.photo_url);
        return { ...p, photo_url: signedUrl };
      }),
    );

    const profilesMap = new Map(
      profilesWithSignedUrls.map((p) => [
        p.id,
        { full_name: p.full_name, nik: p.nik, departemen: p.departemen, photo_url: p.photo_url },
      ]),
    );

    const combinedData = leaveData.map((request) => ({
      ...request,
      type: "leave" as const,
      profiles: profilesMap.get(request.user_id) || { full_name: "Unknown", nik: "-", departemen: "-" },
    }));

    setLeaveNotifications(combinedData as any);
  };

  const fetchOvertimeRequests = async () => {
    const { data: overtimeData } = await supabase
      .from("overtime_requests")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (!overtimeData || overtimeData.length === 0) {
      setOvertimeNotifications([]);
      return;
    }

    const userIds = [...new Set(overtimeData.map((o) => o.user_id))];
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, full_name, nik, departemen, photo_url")
      .in("id", userIds);

    // Generate signed URLs for photos
    const profilesWithSignedUrls = await Promise.all(
      (profilesData || []).map(async (p) => {
        const signedUrl = await getSignedPhotoUrl(p.photo_url);
        return { ...p, photo_url: signedUrl };
      }),
    );

    const profilesMap = new Map(
      profilesWithSignedUrls.map((p) => [
        p.id,
        { full_name: p.full_name, nik: p.nik, departemen: p.departemen, photo_url: p.photo_url },
      ]),
    );

    const combinedData = overtimeData.map((request) => ({
      ...request,
      type: "overtime" as const,
      profiles: profilesMap.get(request.user_id) || { full_name: "Unknown", nik: "-", departemen: "-" },
    }));

    setOvertimeNotifications(combinedData as any);
  };

  const setupRealtimeSubscriptions = () => {
    // Subscribe to attendance changes
    const attendanceChannel = supabase
      .channel("attendance-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "attendance",
        },
        (payload) => {
          console.log("Attendance change:", payload);
          fetchAttendance();

          if (payload.eventType === "INSERT") {
            toast({
              title: "Check-In Baru",
              description: "Seorang karyawan baru saja check-in",
            });
          } else if (payload.eventType === "UPDATE" && payload.new.check_out_time) {
            toast({
              title: "Check-Out Baru",
              description: "Seorang karyawan baru saja check-out",
            });
          }
        },
      )
      .subscribe();

    // Subscribe to leave requests
    const leaveChannel = supabase
      .channel("leave-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leave_requests",
        },
        (payload) => {
          console.log("Leave request change:", payload);
          fetchLeaveRequests();

          if (payload.eventType === "INSERT") {
            toast({
              title: "Pengajuan Cuti Baru",
              description: "Ada pengajuan cuti yang memerlukan persetujuan",
            });
          }
        },
      )
      .subscribe();

    // Subscribe to overtime requests
    const overtimeChannel = supabase
      .channel("overtime-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "overtime_requests",
        },
        (payload) => {
          console.log("Overtime request change:", payload);
          fetchOvertimeRequests();

          if (payload.eventType === "INSERT") {
            toast({
              title: "Pengajuan Lembur Baru",
              description: "Ada pengajuan lembur yang memerlukan persetujuan",
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(attendanceChannel);
      supabase.removeChannel(leaveChannel);
      supabase.removeChannel(overtimeChannel);
    };
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "hadir":
        return <Badge className="bg-primary">Hadir</Badge>;
      case "terlambat":
        return <Badge variant="destructive">Terlambat</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Pusat Notifikasi</h1>
            <p className="text-muted-foreground mt-1">
              Aktivitas real-time hari ini -{" "}
              {new Date().toLocaleDateString("id-ID", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
          <Button variant="outline" size="icon" onClick={fetchAllNotifications} disabled={isRefreshing}>
            <RefreshCw className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Check-In Hari Ini</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <span className="text-3xl font-bold">{attendanceNotifications.length}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pengajuan Cuti Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-secondary" />
                <span className="text-3xl font-bold">{leaveNotifications.length}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pengajuan Lembur Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-accent" />
                <span className="text-3xl font-bold">{overtimeNotifications.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="attendance" className="space-y-4">
          <TabsList>
            <TabsTrigger value="attendance">Aktivitas Absensi ({attendanceNotifications.length})</TabsTrigger>
            <TabsTrigger value="leave">Cuti Pending ({leaveNotifications.length})</TabsTrigger>
            <TabsTrigger value="overtime">Lembur Pending ({overtimeNotifications.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="attendance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Aktivitas Absensi</CardTitle>
                <CardDescription>Check-in dan check-out karyawan</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {attendanceNotifications.length > 0 ? (
                    attendanceNotifications.map((notification) => (
                      <div
                        key={notification.id}
                        className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/5 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <EmployeeAvatar
                            src={notification.profiles.photo_url}
                            name={notification.profiles.full_name}
                            fallbackClassName="bg-primary/10 text-primary"
                          />
                          <div>
                            <p className="font-semibold">{notification.profiles.full_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {notification.profiles.departemen} • {notification.profiles.nik}
                            </p>
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          <div className="flex items-center gap-2 justify-end">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">
                              {formatTime(notification.check_in_time)}
                              {notification.check_out_time && ` - ${formatTime(notification.check_out_time)}`}
                            </span>
                          </div>
                          {getStatusBadge(notification.status)}
                          {notification.notes && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              <span>{notification.notes}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">Belum ada aktivitas absensi hari ini</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leave" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Pengajuan Cuti Menunggu Persetujuan</CardTitle>
                <CardDescription>Tinjau dan setujui pengajuan cuti karyawan</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {leaveNotifications.length > 0 ? (
                    leaveNotifications.map((notification) => (
                      <div
                        key={notification.id}
                        className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/5 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <EmployeeAvatar
                            src={notification.profiles.photo_url}
                            name={notification.profiles.full_name}
                            fallbackClassName="bg-secondary/10 text-secondary"
                          />
                          <div>
                            <p className="font-semibold">{notification.profiles.full_name}</p>
                            <p className="text-sm text-muted-foreground">{notification.profiles.departemen}</p>
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          <p className="text-sm text-muted-foreground">{formatDate(notification.created_at)}</p>
                          {getStatusBadge(notification.status)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">Tidak ada pengajuan cuti yang pending</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="overtime" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Pengajuan Lembur Menunggu Persetujuan</CardTitle>
                <CardDescription>Tinjau dan setujui pengajuan lembur karyawan</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {overtimeNotifications.length > 0 ? (
                    overtimeNotifications.map((notification) => (
                      <div
                        key={notification.id}
                        className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/5 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <EmployeeAvatar
                            src={notification.profiles.photo_url}
                            name={notification.profiles.full_name}
                            fallbackClassName="bg-accent/10 text-accent"
                          />
                          <div>
                            <p className="font-semibold">{notification.profiles.full_name}</p>
                            <p className="text-sm text-muted-foreground">{notification.profiles.departemen}</p>
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          <p className="text-sm text-muted-foreground">{formatDate(notification.created_at)}</p>
                          {getStatusBadge(notification.status)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      Tidak ada pengajuan lembur yang pending
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Notifications;
