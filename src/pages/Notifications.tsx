import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmployeeAvatar } from "@/components/ui/employee-avatar";
import { Clock, Calendar, CheckCircle2, MapPin, RefreshCw, Plane, ChevronLeft, ChevronRight } from "lucide-react";
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

interface BusinessTravelNotification {
  id: string;
  user_id: string;
  destination: string;
  purpose: string;
  start_date: string;
  end_date: string;
  total_days: number;
  status: string;
  created_at: string;
  profiles: {
    full_name: string;
    nik: string;
    departemen: string;
    photo_url?: string;
  };
}

const Notifications = () => {
  const [attendanceNotifications, setAttendanceNotifications] = useState<AttendanceNotification[]>([]);
  const [leaveNotifications, setLeaveNotifications] = useState<RequestNotification[]>([]);
  const [overtimeNotifications, setOvertimeNotifications] = useState<RequestNotification[]>([]);
  const [businessTravelNotifications, setBusinessTravelNotifications] = useState<BusinessTravelNotification[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [attendancePage, setAttendancePage] = useState(1);
  const [leavePage, setLeavePage] = useState(1);
  const [overtimePage, setOvertimePage] = useState(1);
  const [travelPage, setTravelPage] = useState(1);
  const itemsPerPage = 10;
  const { toast } = useToast();
  const navigate = useNavigate();

  // Pagination helpers
  const getPaginatedData = <T,>(data: T[], page: number) => 
    data.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const getTotalPages = (total: number) => Math.ceil(total / itemsPerPage);

  useEffect(() => {
    fetchAllNotifications();
    setupRealtimeSubscriptions();
  }, []);

  const fetchAllNotifications = async () => {
    setIsRefreshing(true);
    await Promise.all([
      fetchAttendance(),
      fetchLeaveRequests(),
      fetchOvertimeRequests(),
      fetchBusinessTravelRequests(),
    ]);
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

  const fetchBusinessTravelRequests = async () => {
    const { data: travelData } = await supabase
      .from("business_travel_requests")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (!travelData || travelData.length === 0) {
      setBusinessTravelNotifications([]);
      return;
    }

    const userIds = [...new Set(travelData.map((t) => t.user_id))];
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, full_name, nik, departemen, photo_url")
      .in("id", userIds);

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

    const combinedData = travelData.map((request) => ({
      ...request,
      profiles: profilesMap.get(request.user_id) || { full_name: "Unknown", nik: "-", departemen: "-" },
    }));

    setBusinessTravelNotifications(combinedData as BusinessTravelNotification[]);
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

    // Subscribe to business travel requests
    const travelChannel = supabase
      .channel("business-travel-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "business_travel_requests",
        },
        (payload) => {
          console.log("Business travel request change:", payload);
          fetchBusinessTravelRequests();

          if (payload.eventType === "INSERT") {
            toast({
              title: "Pengajuan Perjalanan Dinas Baru",
              description: "Ada pengajuan perjalanan dinas yang memerlukan persetujuan",
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(attendanceChannel);
      supabase.removeChannel(leaveChannel);
      supabase.removeChannel(overtimeChannel);
      supabase.removeChannel(travelChannel);
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
      case "pulang_cepat":
        return <Badge variant="destructive">Pulang Cepat</Badge>;
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

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Aktivitas Absensi</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <span className="text-3xl font-bold">{attendanceNotifications.length}</span>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:bg-accent/5 transition-colors"
            onClick={() => navigate("/dashboard/leave")}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Cuti Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-secondary" />
                <span className="text-3xl font-bold">{leaveNotifications.length}</span>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:bg-accent/5 transition-colors"
            onClick={() => navigate("/dashboard/overtime")}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Lembur Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-secondary" />
                <span className="text-3xl font-bold">{overtimeNotifications.length}</span>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:bg-accent/5 transition-colors"
            onClick={() => navigate("/dashboard/business-travel")}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Perjalanan Dinas Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Plane className="h-5 w-5 text-primary" />
                <span className="text-3xl font-bold">{businessTravelNotifications.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="attendance" className="space-y-4">
          <TabsList>
            <TabsTrigger value="attendance">Aktivitas Absensi ({attendanceNotifications.length})</TabsTrigger>
            <TabsTrigger value="leave">Cuti Pending ({leaveNotifications.length})</TabsTrigger>
            <TabsTrigger value="overtime">Lembur Pending ({overtimeNotifications.length})</TabsTrigger>
            <TabsTrigger value="travel">Perjalanan Dinas ({businessTravelNotifications.length})</TabsTrigger>
          </TabsList>

          {/* ✅ TAB AKTIVITAS ABSENSI – SUDAH ADA TANGGAL */}
          <TabsContent value="attendance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Aktivitas Absensi</CardTitle>
                <CardDescription>Check-in dan check-out karyawan</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[calc(100vh-400px)] overflow-auto">
                  {attendanceNotifications.length > 0 ? (
                    getPaginatedData(attendanceNotifications, attendancePage).map((notification) => (
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
                          <div className="flex items-center gap-1 justify-end text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>{formatDate(notification.check_in_time || notification.created_at)}</span>
                          </div>
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
                {getTotalPages(attendanceNotifications.length) > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      {(attendancePage - 1) * itemsPerPage + 1} - {Math.min(attendancePage * itemsPerPage, attendanceNotifications.length)} dari {attendanceNotifications.length}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setAttendancePage(p => Math.max(1, p - 1))} disabled={attendancePage === 1}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm">{attendancePage} / {getTotalPages(attendanceNotifications.length)}</span>
                      <Button variant="outline" size="sm" onClick={() => setAttendancePage(p => Math.min(getTotalPages(attendanceNotifications.length), p + 1))} disabled={attendancePage === getTotalPages(attendanceNotifications.length)}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
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
                <div className="space-y-3 max-h-[calc(100vh-400px)] overflow-auto">
                  {leaveNotifications.length > 0 ? (
                    getPaginatedData(leaveNotifications, leavePage).map((notification) => (
                      <div
                        key={notification.id}
                        className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/5 transition-colors cursor-pointer"
                        onClick={() => navigate("/dashboard/leave")}
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
                {getTotalPages(leaveNotifications.length) > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      {(leavePage - 1) * itemsPerPage + 1} - {Math.min(leavePage * itemsPerPage, leaveNotifications.length)} dari {leaveNotifications.length}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setLeavePage(p => Math.max(1, p - 1))} disabled={leavePage === 1}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm">{leavePage} / {getTotalPages(leaveNotifications.length)}</span>
                      <Button variant="outline" size="sm" onClick={() => setLeavePage(p => Math.min(getTotalPages(leaveNotifications.length), p + 1))} disabled={leavePage === getTotalPages(leaveNotifications.length)}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
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
                <div className="space-y-3 max-h-[calc(100vh-400px)] overflow-auto">
                  {overtimeNotifications.length > 0 ? (
                    getPaginatedData(overtimeNotifications, overtimePage).map((notification) => (
                      <div
                        key={notification.id}
                        className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/5 transition-colors cursor-pointer"
                        onClick={() => navigate("/dashboard/overtime")}
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
                {getTotalPages(overtimeNotifications.length) > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      {(overtimePage - 1) * itemsPerPage + 1} - {Math.min(overtimePage * itemsPerPage, overtimeNotifications.length)} dari {overtimeNotifications.length}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setOvertimePage(p => Math.max(1, p - 1))} disabled={overtimePage === 1}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm">{overtimePage} / {getTotalPages(overtimeNotifications.length)}</span>
                      <Button variant="outline" size="sm" onClick={() => setOvertimePage(p => Math.min(getTotalPages(overtimeNotifications.length), p + 1))} disabled={overtimePage === getTotalPages(overtimeNotifications.length)}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="travel" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Pengajuan Perjalanan Dinas Menunggu Persetujuan</CardTitle>
                <CardDescription>Tinjau dan setujui pengajuan perjalanan dinas karyawan</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[calc(100vh-400px)] overflow-auto">
                  {businessTravelNotifications.length > 0 ? (
                    getPaginatedData(businessTravelNotifications, travelPage).map((notification) => (
                      <div
                        key={notification.id}
                        className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/5 transition-colors cursor-pointer"
                        onClick={() => navigate("/dashboard/business-travel")}
                      >
                        <div className="flex items-center gap-4">
                          <EmployeeAvatar
                            src={notification.profiles.photo_url}
                            name={notification.profiles.full_name}
                            fallbackClassName="bg-primary/10 text-primary"
                          />
                          <div>
                            <p className="font-semibold">{notification.profiles.full_name}</p>
                            <p className="text-sm text-muted-foreground">{notification.profiles.departemen}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              <MapPin className="h-3 w-3 inline mr-1" />
                              {notification.destination}
                            </p>
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          <p className="text-sm text-muted-foreground">
                            {new Date(notification.start_date).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                            })}{" "}
                            -{" "}
                            {new Date(notification.end_date).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                            })}
                          </p>
                          <Badge variant="secondary">{notification.total_days} hari</Badge>
                          {getStatusBadge(notification.status)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      Tidak ada pengajuan perjalanan dinas yang pending
                    </div>
                  )}
                </div>
                {getTotalPages(businessTravelNotifications.length) > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      {(travelPage - 1) * itemsPerPage + 1} - {Math.min(travelPage * itemsPerPage, businessTravelNotifications.length)} dari {businessTravelNotifications.length}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setTravelPage(p => Math.max(1, p - 1))} disabled={travelPage === 1}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm">{travelPage} / {getTotalPages(businessTravelNotifications.length)}</span>
                      <Button variant="outline" size="sm" onClick={() => setTravelPage(p => Math.min(getTotalPages(businessTravelNotifications.length), p + 1))} disabled={travelPage === getTotalPages(businessTravelNotifications.length)}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Notifications;
