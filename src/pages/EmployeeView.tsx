import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, MapPin, LogOut, User, Calendar, FileText, ChevronRight, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import logo from "@/assets/logo.png";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CameraCapture } from "@/components/CameraCapture";
import { EmployeeBottomNav } from "@/components/EmployeeBottomNav";
import { useNavigate } from "react-router-dom";

// Office coordinates and work hours will be fetched from system settings

interface WorkHoursConfig {
  check_in_start: string;
  check_in_end: string;
  check_out_start: string;
  check_out_end: string;
  late_tolerance_minutes: number;
  early_leave_tolerance_minutes: number;
}
interface StatsData {
  leaveBalance: number;
  leaveTotal: number;
  attendanceCount: number;
}
const EmployeeView = () => {
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [checkInTime, setCheckInTime] = useState<string | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [recentAttendance, setRecentAttendance] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraMode, setCameraMode] = useState<"checkin" | "checkout">("checkin");
  const [officeLocations, setOfficeLocations] = useState<Array<{
    name: string;
    latitude: number;
    longitude: number;
    radius: number;
  }>>([]);
  const [workHours, setWorkHours] = useState<WorkHoursConfig | null>(null);
  const [stats, setStats] = useState<StatsData>({
    leaveBalance: 0,
    leaveTotal: 12,
    attendanceCount: 0
  });
  const [currentTime, setCurrentTime] = useState(new Date());
  const [gpsStatus, setGpsStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [nearestOffice, setNearestOffice] = useState<{
    name: string;
    distance: number;
  } | null>(null);
  const {
    signOut,
    profile
  } = useAuth();
  const {
    toast
  } = useToast();
  const navigate = useNavigate();
  useEffect(() => {
    fetchOfficeLocation();
    fetchWorkHours();
    fetchTodayAttendance();
    fetchRecentAttendance();
    fetchStats();
  }, [profile?.id]);

  // Real-time clock update
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch GPS location on mount
  useEffect(() => {
    const fetchGpsLocation = async () => {
      if (officeLocations.length === 0) return;
      setGpsStatus("loading");
      try {
        const location = await getCurrentLocation();
        setCurrentLocation(location);

        // Find nearest office
        let nearest: {
          name: string;
          distance: number;
        } | null = null;
        for (const office of officeLocations) {
          const distance = calculateDistance(location.latitude, location.longitude, office.latitude, office.longitude);
          if (!nearest || distance < nearest.distance) {
            nearest = {
              name: office.name,
              distance
            };
          }
        }
        setNearestOffice(nearest);
        setGpsStatus("success");
      } catch (error) {
        console.error("GPS error:", error);
        setGpsStatus("error");
      }
    };
    if (officeLocations.length > 0) {
      fetchGpsLocation();
    }
  }, [officeLocations]);
  const fetchOfficeLocation = async () => {
    try {
      const {
        data,
        error
      } = await supabase.rpc("get_office_locations");
      if (error) throw error;
      if (data && Array.isArray(data)) {
        const locations = data as Array<{
          name: string;
          latitude: number;
          longitude: number;
          radius: number;
        }>;
        setOfficeLocations(locations);
      }
    } catch (error) {
      console.error("Error fetching office locations:", error);
    }
  };
  const fetchWorkHours = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from("system_settings").select("value").eq("key", "work_hours").maybeSingle();
      if (error) throw error;
      if (data) {
        setWorkHours(data.value as unknown as WorkHoursConfig);
      }
    } catch (error) {
      console.error("Error fetching work hours:", error);
    }
  };
  const fetchTodayAttendance = async () => {
    const today = new Date().toISOString().split("T")[0];
    const {
      data
    } = await supabase.from("attendance").select("*").gte("check_in_time", `${today}T00:00:00`).lte("check_in_time", `${today}T23:59:59`).single();
    if (data) {
      setTodayAttendance(data);
      setIsCheckedIn(true);
      setCheckInTime(new Date(data.check_in_time).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit"
      }));
    } else {
      // No attendance today - reset state
      setTodayAttendance(null);
      setIsCheckedIn(false);
      setCheckInTime(null);
    }
  };
  const fetchRecentAttendance = async () => {
    const {
      data
    } = await supabase.from("attendance").select("*").order("check_in_time", {
      ascending: false
    }).limit(3);
    if (data) {
      setRecentAttendance(data);
    }
  };
  const fetchStats = async () => {
    if (!profile?.id) return;
    try {
      // Get current month attendance count
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
      const {
        count: attendanceCount
      } = await supabase.from("attendance").select("*", {
        count: "exact",
        head: true
      }).eq("user_id", profile.id).gte("check_in_time", startOfMonth).lte("check_in_time", endOfMonth);
      setStats({
        leaveBalance: profile.remaining_leave || 0,
        leaveTotal: profile.annual_leave_quota || 12,
        attendanceCount: attendanceCount || 0
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in meters
  };
  const getCurrentLocation = (): Promise<{
    latitude: number;
    longitude: number;
  }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation tidak didukung oleh browser Anda"));
        return;
      }
      navigator.geolocation.getCurrentPosition(position => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
      }, error => {
        reject(new Error("Tidak dapat mengakses lokasi: " + error.message));
      }, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });
    });
  };
  const handleCheckIn = async (photoUrl: string) => {
    setIsProcessing(true);
    try {
      // Step 1: Convert blob URL to base64
      const response = await fetch(photoUrl);
      const blob = await response.blob();
      const reader = new FileReader();
      await new Promise((resolve, reject) => {
        reader.onloadend = async () => {
          try {
            const base64Photo = reader.result as string;

            // Step 2: Get current location
            const location = await getCurrentLocation();

            // Step 3: Check distance from all office locations
            if (officeLocations.length === 0) {
              throw new Error("Lokasi kantor belum dikonfigurasi. Hubungi admin.");
            }
            let nearestOffice: {
              name: string;
              distance: number;
              radius: number;
            } | null = null;
            for (const office of officeLocations) {
              const distance = calculateDistance(location.latitude, location.longitude, office.latitude, office.longitude);
              if (distance <= office.radius) {
                if (!nearestOffice || distance < nearestOffice.distance) {
                  nearestOffice = {
                    name: office.name,
                    distance,
                    radius: office.radius
                  };
                }
              }
            }
            if (!nearestOffice) {
              const distances = officeLocations.map(office => {
                const d = calculateDistance(location.latitude, location.longitude, office.latitude, office.longitude);
                return `${office.name}: ${Math.round(d)}m`;
              }).join(", ");
              toast({
                title: "Lokasi Tidak Valid",
                description: `Anda tidak berada di area kantor manapun. Jarak: ${distances}`,
                variant: "destructive"
              });
              setIsProcessing(false);
              return;
            }

            // Step 4: Record check-in with status based on work hours settings
            const now = new Date();
            let status: "hadir" | "terlambat" = "hadir";
            const checkInHour = now.getHours();
            const checkInMinute = now.getMinutes();
            const checkInTotalMinutes = checkInHour * 60 + checkInMinute;
            if (workHours && workHours.check_in_end) {
              // Parse check_in_end time (e.g., "09:00")
              const [endHour, endMinute] = workHours.check_in_end.split(":").map(Number);
              const lateThreshold = endHour * 60 + endMinute + (workHours.late_tolerance_minutes || 0);
              console.log("Work hours check:", {
                checkInTotalMinutes,
                lateThreshold,
                checkInEnd: workHours.check_in_end
              });
              if (checkInTotalMinutes > lateThreshold) {
                status = "terlambat";
              }
            } else {
              // Default: jam 09:00 + 15 menit toleransi = 09:15 (555 menit)
              const defaultLateThreshold = 9 * 60 + 15; // 555 menit
              console.log("Default check:", {
                checkInTotalMinutes,
                defaultLateThreshold
              });
              if (checkInTotalMinutes > defaultLateThreshold) {
                status = "terlambat";
              }
            }
            const {
              data,
              error
            } = await supabase.from("attendance").insert([{
              user_id: profile?.id!,
              check_in_time: now.toISOString(),
              check_in_latitude: location.latitude,
              check_in_longitude: location.longitude,
              check_in_photo_url: base64Photo,
              gps_validated: true,
              face_recognition_validated: false,
              status: status,
              notes: `Check-in di ${nearestOffice.name} (${Math.round(nearestOffice.distance)}m)`
            }]).select().single();
            if (error) throw error;
            setIsCheckedIn(true);
            setTodayAttendance(data);
            setCheckInTime(now.toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit"
            }));
            toast({
              title: "Check-In Berhasil",
              description: `Terima kasih! Check-in di ${nearestOffice.name} (${Math.round(nearestOffice.distance)}m)`
            });
            fetchRecentAttendance();
            resolve(true);
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error: any) {
      toast({
        title: "Check-In Gagal",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };
  const handleCheckOut = async (photoUrl: string) => {
    setIsProcessing(true);
    try {
      // Step 1: Convert blob URL to base64
      const response = await fetch(photoUrl);
      const blob = await response.blob();
      const reader = new FileReader();
      await new Promise((resolve, reject) => {
        reader.onloadend = async () => {
          try {
            const base64Photo = reader.result as string;

            // Step 2: Get location and validate
            const location = await getCurrentLocation();

            // Check if within range of any office
            let isValidLocation = false;
            let nearestOffice: {
              name: string;
              distance: number;
            } | null = null;
            for (const office of officeLocations) {
              const distance = calculateDistance(location.latitude, location.longitude, office.latitude, office.longitude);
              if (distance <= office.radius) {
                isValidLocation = true;
                if (!nearestOffice || distance < nearestOffice.distance) {
                  nearestOffice = {
                    name: office.name,
                    distance
                  };
                }
              }
            }
            const now = new Date();
            const checkInTime = new Date(todayAttendance.check_in_time);
            const durationMinutes = Math.floor((now.getTime() - checkInTime.getTime()) / 60000);

            // Determine checkout status based on time
            let finalStatus = todayAttendance.status;
            const checkOutHour = now.getHours();
            const checkOutMinute = now.getMinutes();
            const checkOutTotalMinutes = checkOutHour * 60 + checkOutMinute;
            if (workHours && workHours.check_out_start) {
              const [startHour, startMinute] = workHours.check_out_start.split(":").map(Number);
              const earlyLeaveThreshold = startHour * 60 + startMinute - (workHours.early_leave_tolerance_minutes || 0);
              console.log("Checkout check:", {
                checkOutTotalMinutes,
                earlyLeaveThreshold,
                checkOutStart: workHours.check_out_start
              });
              if (checkOutTotalMinutes < earlyLeaveThreshold) {
                finalStatus = "pulang_cepat";
              }
            } else {
              // Default: sebelum 16:45 (17:00 - 15 menit toleransi) = pulang cepat
              const defaultEarlyLeaveThreshold = 17 * 60 - 15; // 1005 menit (16:45)
              console.log("Default checkout:", {
                checkOutTotalMinutes,
                defaultEarlyLeaveThreshold
              });
              if (checkOutTotalMinutes < defaultEarlyLeaveThreshold) {
                finalStatus = "pulang_cepat";
              }
            }
            const {
              data: updatedData,
              error
            } = await supabase.from("attendance").update({
              check_out_time: now.toISOString(),
              check_out_latitude: location.latitude,
              check_out_longitude: location.longitude,
              check_out_photo_url: base64Photo,
              duration_minutes: durationMinutes,
              status: finalStatus,
              notes: nearestOffice ? `Check-in di ${todayAttendance.notes?.split(" di ")[1] || "kantor"}, Check-out di ${nearestOffice.name} (${Math.round(nearestOffice.distance)}m)` : todayAttendance.notes
            }).eq("id", todayAttendance.id).select().single();
            if (error) throw error;

            // Update state with checkout time - keep isCheckedIn true to show completed attendance
            setTodayAttendance(updatedData);
            toast({
              title: "Check-Out Berhasil",
              description: finalStatus === "pulang_cepat" ? "Anda pulang lebih awal dari jadwal" : "Sampai jumpa besok!"
            });
            fetchRecentAttendance();
            resolve(true);
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error: any) {
      toast({
        title: "Check-Out Gagal",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };
  const formatStatus = (status: string) => {
    const statusMap: Record<string, string> = {
      hadir: "Hadir",
      terlambat: "Terlambat",
      pulang_cepat: "Pulang Cepat",
      tidak_hadir: "Tidak Hadir"
    };
    return statusMap[status] || status;
  };
  return <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/10 pb-24">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <img src={logo} alt="Kemika" className="h-10 object-contain" />
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-lg space-y-6">
        {/* Welcome Card with Profile */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 ring-2 ring-primary/20">
                <AvatarImage src={profile?.photo_url || undefined} alt={profile?.full_name} />
                <AvatarFallback className="bg-primary/10 text-primary text-lg">
                  {profile?.full_name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || <User className="h-8 w-8" />}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <CardTitle className="text-xl">
                  Assalamualaikum,
                  <br />
                  {profile?.full_name || "User"}!
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {profile?.jabatan || "Karyawan"}
                </p>
                <CardDescription className="mt-2">
                  {currentTime.toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "long",
                  year: "numeric"
                })}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Check-In/Out Card */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            {/* Real-time Clock */}
            <div className="text-center">
              <div className="text-5xl font-bold text-primary tabular-nums tracking-wider">
                {currentTime.getHours().toString().padStart(2, "0")}
                <span className="animate-pulse">.</span>
                {currentTime.getMinutes().toString().padStart(2, "0")}
              </div>
            </div>

            {/* GPS Status */}
            <div className="flex items-center justify-center gap-2 text-sm">
              {gpsStatus === "loading" && <>
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="text-muted-foreground">Mendeteksi lokasi...</span>
                </>}
              {gpsStatus === "success" && nearestOffice && <>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-muted-foreground">
                    {nearestOffice.name} •{" "}
                    <span className={nearestOffice.distance <= 100 ? "text-green-600 font-medium" : "text-destructive"}>
                      {Math.round(nearestOffice.distance)}m
                    </span>
                  </span>
                </>}
              {gpsStatus === "error" && <>
                  <XCircle className="h-4 w-4 text-destructive" />
                  <span className="text-destructive">Gagal mendeteksi lokasi</span>
                </>}
              {gpsStatus === "idle" && <>
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">GPS akan divalidasi</span>
                </>}
            </div>

            {/* Check-in/Check-out Time Pills */}
            <div className="flex gap-2">
              <div className="flex-1 bg-primary/10 rounded-lg px-4 py-3 pl-[5px] pr-[26px]">
                <span className="text-sm font-medium text-foreground">
                  Check-in:{" "}
                  {todayAttendance?.check_in_time ? <span className="text-primary font-semibold">
                      {new Date(todayAttendance.check_in_time).toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                    </span> : <span className="text-muted-foreground">-</span>}
                </span>
              </div>
              <div className="flex-1 bg-muted rounded-lg px-4 py-3 pl-[5px] pr-[24px]">
                <span className="text-sm font-medium text-foreground">
                  Check-out:{" "}
                  {todayAttendance?.check_out_time ? <span className="text-primary font-semibold">
                      {new Date(todayAttendance.check_out_time).toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                    </span> : <span className="text-muted-foreground">-</span>}
                </span>
              </div>
            </div>

            {/* Action Button */}
            {todayAttendance?.check_out_time ? <div className="text-center py-3 text-muted-foreground">Absensi hari ini selesai</div> : todayAttendance ? <Button onClick={() => {
            setCameraMode("checkout");
            setShowCamera(true);
          }} disabled={isProcessing} className="w-full h-14 font-semibold text-lg bg-primary hover:bg-primary/90">
                {isProcessing ? "Memproses..." : "Check Out"}
              </Button> : <Button onClick={() => {
            setCameraMode("checkin");
            setShowCamera(true);
          }} disabled={isProcessing} className="w-full h-14 font-semibold bg-primary hover:bg-primary/90 text-base">
                {isProcessing ? "Memproses..." : "Check In"}
              </Button>}
          </CardContent>
        </Card>

        {/* Stats Card */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 bg-card rounded-lg cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/employee/leave-request")}>
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Cuti</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-lg font-bold text-primary">
                    {stats.leaveBalance}/{stats.leaveTotal}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-card rounded-lg cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/employee/attendance-history")}>
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <User className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Kehadiran</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-lg font-bold text-primary">{stats.attendanceCount}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-card rounded-lg cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/employee/request-history")}>
                <div className="p-2 bg-orange-500/10 rounded-lg">
                  <FileText className="h-5 w-5 text-orange-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Riwayat</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-lg font-bold text-primary">Lihat</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-card rounded-lg cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/employee/performance")}>
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <User className="h-5 w-5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Performa</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-lg font-bold text-primary">Lihat</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <EmployeeBottomNav />

      <CameraCapture isOpen={showCamera} onClose={() => setShowCamera(false)} onCapture={photoUrl => {
      if (cameraMode === "checkin") {
        handleCheckIn(photoUrl);
      } else {
        handleCheckOut(photoUrl);
      }
    }} title={cameraMode === "checkin" ? "Check-In" : "Check-Out"} />
    </div>;
};
export default EmployeeView;