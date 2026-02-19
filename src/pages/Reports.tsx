import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Download, FileSpreadsheet, FileText, Loader2, User, Coins } from "lucide-react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, eachDayOfInterval, parseISO, isWithinInterval } from "date-fns";
import { DEPARTMENT_OPTIONS } from "@/lib/employeeOptions";
import logoImage from "@/assets/logo.png";
import { formatAttendanceStatus, formatLeaveType } from "@/lib/statusUtils";

const loadImageAsBase64 = (src: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = src;
  });
};

export default function Reports() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState<"attendance" | "leave" | "overtime" | "employees" | "business_travel">(
    "attendance",
  );
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [department, setDepartment] = useState<string>("all");

  // Helper function to fetch admin user IDs
  const fetchAdminUserIds = async (): Promise<Set<string>> => {
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    return new Set(adminRoles?.map((r) => r.user_id) || []);
  };

  const exportToExcel = async () => {
    setLoading(true);
    try {
      let data: any[] = [];
      let filename = "";

      // Fetch admin IDs to exclude from reports
      const adminUserIds = await fetchAdminUserIds();

      if (reportType === "attendance") {
        const { data: attendanceData, error: attendanceError } = await supabase
          .from("attendance")
          .select("*")
          .gte("check_in_time", `${startDate}T00:00:00`)
          .lte("check_in_time", `${endDate}T23:59:59`);

        if (attendanceError) throw attendanceError;

        // Fetch approved leave requests within date range
        const { data: leaveData, error: leaveError } = await supabase
          .from("leave_requests")
          .select("*")
          .eq("status", "approved")
          .lte("start_date", endDate)
          .gte("end_date", startDate);

        if (leaveError) throw leaveError;

        // Fetch approved business travel requests within date range
        const { data: travelData, error: travelError } = await supabase
          .from("business_travel_requests")
          .select("*")
          .eq("status", "approved")
          .lte("start_date", endDate)
          .gte("end_date", startDate);

        if (travelError) throw travelError;

        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, departemen, nik");

        if (profilesError) throw profilesError;

        const profilesMap = new Map(profiles?.map((p) => [p.id, p]) || []);

        // Merge attendance data and exclude admins
        let mergedAttendance =
          attendanceData
            ?.filter((record) => !adminUserIds.has(record.user_id))
            ?.map((record) => ({
              ...record,
              profiles: profilesMap.get(record.user_id),
            }))
            .filter((record) => record.profiles) || [];

        if (department !== "all") {
          mergedAttendance = mergedAttendance.filter((record) => record.profiles?.departemen === department);
        }

        // Convert attendance to report format
        const attendanceRows = mergedAttendance.map((record: any) => {
          const checkIn = new Date(record.check_in_time);
          const checkOut = record.check_out_time ? new Date(record.check_out_time) : null;
          return {
            Date: format(checkIn, "yyyy-MM-dd"),
            NIK: record.profiles?.nik || "-",
            Name: record.profiles?.full_name || "-",
            Department: record.profiles?.departemen || "-",
            "Check In Time": format(checkIn, "HH:mm"),
            "Check Out Time": checkOut ? format(checkOut, "HH:mm") : "-",
            Status: formatAttendanceStatus(record.status),
            "Duration (min)": record.duration_minutes || "-",
          };
        });

        // Add leave records (expand each day within range)
        const leaveRows: any[] = [];
        const dateRangeStart = parseISO(startDate);
        const dateRangeEnd = parseISO(endDate);

        leaveData?.forEach((leave) => {
          // Skip admin users
          if (adminUserIds.has(leave.user_id)) return;
          const profile = profilesMap.get(leave.user_id);
          if (!profile) return;
          if (department !== "all" && profile.departemen !== department) return;

          const leaveStart = parseISO(leave.start_date);
          const leaveEnd = parseISO(leave.end_date);
          const days = eachDayOfInterval({ start: leaveStart, end: leaveEnd });

          days.forEach((day) => {
            if (isWithinInterval(day, { start: dateRangeStart, end: dateRangeEnd })) {
              leaveRows.push({
                Date: format(day, "yyyy-MM-dd"),
                NIK: profile.nik || "-",
                Name: profile.full_name || "-",
                Department: profile.departemen || "-",
                "Check In Time": "-",
                "Check Out Time": "-",
                Status: formatLeaveType(leave.leave_type),
                "Duration (min)": "-",
              });
            }
          });
        });

        // Add business travel records (expand each day within range)
        const travelRows: any[] = [];
        travelData?.forEach((travel) => {
          // Skip admin users
          if (adminUserIds.has(travel.user_id)) return;
          const profile = profilesMap.get(travel.user_id);
          if (!profile) return;
          if (department !== "all" && profile.departemen !== department) return;

          const travelStart = parseISO(travel.start_date);
          const travelEnd = parseISO(travel.end_date);
          const days = eachDayOfInterval({ start: travelStart, end: travelEnd });

          days.forEach((day) => {
            if (isWithinInterval(day, { start: dateRangeStart, end: dateRangeEnd })) {
              travelRows.push({
                Date: format(day, "yyyy-MM-dd"),
                NIK: profile.nik || "-",
                Name: profile.full_name || "-",
                Department: profile.departemen || "-",
                "Check In Time": "-",
                "Check Out Time": "-",
                Status: "Dinas",
                "Duration (min)": "-",
              });
            }
          });
        });

        // Combine and sort by date, then name
        data = [...attendanceRows, ...leaveRows, ...travelRows].sort((a, b) => {
          const dateCompare = a.Date.localeCompare(b.Date);
          if (dateCompare !== 0) return dateCompare;
          return a.Name.localeCompare(b.Name);
        });

        filename = `Attendance_Report_${startDate}_to_${endDate}.xlsx`;
      } else if (reportType === "leave") {
        const { data: leaveData, error: leaveError } = await supabase
          .from("leave_requests")
          .select("*")
          .gte("start_date", startDate)
          .lte("end_date", endDate);

        if (leaveError) throw leaveError;

        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, departemen, nik");

        if (profilesError) throw profilesError;

        const profilesMap = new Map(profiles?.map((p) => [p.id, p]) || []);

        // Exclude admin users from leave report
        let mergedData =
          leaveData
            ?.filter((record) => !adminUserIds.has(record.user_id))
            ?.map((record) => ({
              ...record,
              profiles: profilesMap.get(record.user_id),
            }))
            .filter((record) => record.profiles) || [];

        if (department !== "all") {
          mergedData = mergedData.filter((record) => record.profiles?.departemen === department);
        }

        data = mergedData.map((record: any) => ({
          NIK: record.profiles?.nik || "-",
          Name: record.profiles?.full_name || "-",
          Department: record.profiles?.departemen || "-",
          "Leave Type": formatLeaveType(record.leave_type),
          "Start Date": record.start_date,
          "End Date": record.end_date,
          "Total Days": record.total_days,
          Status: formatAttendanceStatus(record.status),
          Reason: record.reason,
        }));
        filename = `Leave_Report_${startDate}_to_${endDate}.xlsx`;
      } else if (reportType === "overtime") {
        const { data: overtimeData, error: overtimeError } = await supabase
          .from("overtime_requests")
          .select("*")
          .gte("overtime_date", startDate)
          .lte("overtime_date", endDate);

        if (overtimeError) throw overtimeError;

        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, departemen, nik");

        if (profilesError) throw profilesError;

        const profilesMap = new Map(profiles?.map((p) => [p.id, p]) || []);

        // Exclude admin users from overtime report
        let mergedData =
          overtimeData
            ?.filter((record) => !adminUserIds.has(record.user_id))
            ?.map((record) => ({
              ...record,
              profiles: profilesMap.get(record.user_id),
            }))
            .filter((record) => record.profiles) || [];

        if (department !== "all") {
          mergedData = mergedData.filter((record) => record.profiles?.departemen === department);
        }

        data = mergedData.map((record: any) => ({
          NIK: record.profiles?.nik || "-",
          Name: record.profiles?.full_name || "-",
          Department: record.profiles?.departemen || "-",
          "Overtime Date": record.overtime_date,
          Hours: record.hours,
          Status: formatAttendanceStatus(record.status),
          Reason: record.reason,
        }));
        filename = `Overtime_Report_${startDate}_to_${endDate}.xlsx`;
      } else if (reportType === "business_travel") {
        const { data: travelData, error: travelError } = await supabase
          .from("business_travel_requests")
          .select("*")
          .gte("start_date", startDate)
          .lte("end_date", endDate);

        if (travelError) throw travelError;

        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, departemen, nik");

        if (profilesError) throw profilesError;

        const profilesMap = new Map(profiles?.map((p) => [p.id, p]) || []);

        // Exclude admin users from business travel report
        let mergedData =
          travelData
            ?.filter((record) => !adminUserIds.has(record.user_id))
            ?.map((record) => ({
              ...record,
              profiles: profilesMap.get(record.user_id),
            }))
            .filter((record) => record.profiles) || [];

        if (department !== "all") {
          mergedData = mergedData.filter((record) => record.profiles?.departemen === department);
        }

        data = mergedData.map((record: any) => ({
          NIK: record.profiles?.nik || "-",
          Name: record.profiles?.full_name || "-",
          Department: record.profiles?.departemen || "-",
          Destination: record.destination,
          Purpose: record.purpose,
          "Start Date": record.start_date,
          "End Date": record.end_date,
          "Total Days": record.total_days,
          Status: formatAttendanceStatus(record.status),
          Notes: record.notes || "-",
        }));
        filename = `Business_Travel_Report_${startDate}_to_${endDate}.xlsx`;
      } else {
        let query = supabase.from("profiles").select("*");
        if (department !== "all") query = query.eq("departemen", department);

        const { data: employeeData, error } = await query;
        if (error) throw error;

        // Exclude admin users from employee database report
        const filteredEmployees = employeeData?.filter((emp) => !adminUserIds.has(emp.id)) || [];

        data = filteredEmployees.map((emp: any) => ({
          NIK: emp.nik,
          "Full Name": emp.full_name,
          Email: emp.email,
          Department: emp.departemen,
          Position: emp.jabatan,
          Phone: emp.phone || "-",
          "Join Date": emp.join_date,
          "Annual Leave Quota": emp.annual_leave_quota,
          "Remaining Leave": emp.remaining_leave,
          Status: emp.status,
        }));
        filename = `Employee_Database_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      }

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Report");
      XLSX.writeFile(wb, filename);

      toast({ title: "Berhasil", description: "Laporan berhasil diekspor ke Excel" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = async () => {
    setLoading(true);
    try {
      let data: any[] = [];
      let columns: string[] = [];
      let title = "";

      // Fetch admin IDs to exclude from reports
      const adminUserIds = await fetchAdminUserIds();

      if (reportType === "attendance") {
        const { data: attendanceData, error: attendanceError } = await supabase
          .from("attendance")
          .select("*")
          .gte("check_in_time", `${startDate}T00:00:00`)
          .lte("check_in_time", `${endDate}T23:59:59`);

        if (attendanceError) throw attendanceError;

        // Fetch approved leave requests within date range
        const { data: leaveData, error: leaveError } = await supabase
          .from("leave_requests")
          .select("*")
          .eq("status", "approved")
          .lte("start_date", endDate)
          .gte("end_date", startDate);

        if (leaveError) throw leaveError;

        // Fetch approved business travel requests within date range
        const { data: travelData, error: travelError } = await supabase
          .from("business_travel_requests")
          .select("*")
          .eq("status", "approved")
          .lte("start_date", endDate)
          .gte("end_date", startDate);

        if (travelError) throw travelError;

        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, departemen, nik");

        if (profilesError) throw profilesError;

        const profilesMap = new Map(profiles?.map((p) => [p.id, p]) || []);

        // Merge attendance data and exclude admins
        let mergedAttendance =
          attendanceData
            ?.filter((record) => !adminUserIds.has(record.user_id))
            ?.map((record) => ({
              ...record,
              profiles: profilesMap.get(record.user_id),
            }))
            .filter((record) => record.profiles) || [];

        if (department !== "all") {
          mergedAttendance = mergedAttendance.filter((record) => record.profiles?.departemen === department);
        }

        columns = ["Date", "NIK", "Name", "Department", "Check In", "Check Out", "Status"];

        // Convert attendance to report format
        const attendanceRows = mergedAttendance.map((record: any) => {
          const checkIn = new Date(record.check_in_time);
          const checkOut = record.check_out_time ? new Date(record.check_out_time) : null;
          return [
            format(checkIn, "yyyy-MM-dd"),
            record.profiles?.nik || "-",
            record.profiles?.full_name || "-",
            record.profiles?.departemen || "-",
            format(checkIn, "HH:mm"),
            checkOut ? format(checkOut, "HH:mm") : "-",
            formatAttendanceStatus(record.status),
          ];
        });

        // Add leave records (expand each day within range)
        const leaveRows: any[] = [];
        const dateRangeStart = parseISO(startDate);
        const dateRangeEnd = parseISO(endDate);

        leaveData?.forEach((leave) => {
          // Skip admin users
          if (adminUserIds.has(leave.user_id)) return;
          const profile = profilesMap.get(leave.user_id);
          if (!profile) return;
          if (department !== "all" && profile.departemen !== department) return;

          const leaveStart = parseISO(leave.start_date);
          const leaveEnd = parseISO(leave.end_date);
          const days = eachDayOfInterval({ start: leaveStart, end: leaveEnd });

          days.forEach((day) => {
            if (isWithinInterval(day, { start: dateRangeStart, end: dateRangeEnd })) {
              leaveRows.push([
                format(day, "yyyy-MM-dd"),
                profile.nik || "-",
                profile.full_name || "-",
                profile.departemen || "-",
                "-",
                "-",
                formatLeaveType(leave.leave_type),
              ]);
            }
          });
        });

        // Add business travel records (expand each day within range)
        const travelRows: any[] = [];
        travelData?.forEach((travel) => {
          // Skip admin users
          if (adminUserIds.has(travel.user_id)) return;
          const profile = profilesMap.get(travel.user_id);
          if (!profile) return;
          if (department !== "all" && profile.departemen !== department) return;

          const travelStart = parseISO(travel.start_date);
          const travelEnd = parseISO(travel.end_date);
          const days = eachDayOfInterval({ start: travelStart, end: travelEnd });

          days.forEach((day) => {
            if (isWithinInterval(day, { start: dateRangeStart, end: dateRangeEnd })) {
              travelRows.push([
                format(day, "yyyy-MM-dd"),
                profile.nik || "-",
                profile.full_name || "-",
                profile.departemen || "-",
                "-",
                "-",
                "Dinas",
              ]);
            }
          });
        });

        // Combine and sort by date, then name
        data = [...attendanceRows, ...leaveRows, ...travelRows].sort((a, b) => {
          const dateCompare = a[0].localeCompare(b[0]);
          if (dateCompare !== 0) return dateCompare;
          return a[2].localeCompare(b[2]);
        });

        title = `Laporan Absensi (${startDate} s.d ${endDate})`;
      } else if (reportType === "leave") {
        const { data: leaveData, error: leaveError } = await supabase
          .from("leave_requests")
          .select("*")
          .gte("start_date", startDate)
          .lte("end_date", endDate);

        if (leaveError) throw leaveError;

        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, departemen, nik");

        if (profilesError) throw profilesError;

        const profilesMap = new Map(profiles?.map((p) => [p.id, p]) || []);

        // Exclude admin users from leave PDF report
        let mergedData =
          leaveData
            ?.filter((record) => !adminUserIds.has(record.user_id))
            ?.map((record) => ({
              ...record,
              profiles: profilesMap.get(record.user_id),
            }))
            .filter((record) => record.profiles) || [];

        if (department !== "all") {
          mergedData = mergedData.filter((record) => record.profiles?.departemen === department);
        }

        columns = ["NIK", "Name", "Department", "Leave Type", "Start", "End", "Days", "Status"];
        data = mergedData.map((record: any) => [
          record.profiles?.nik || "-",
          record.profiles?.full_name || "-",
          record.profiles?.departemen || "-",
          formatLeaveType(record.leave_type),
          record.start_date,
          record.end_date,
          record.total_days,
          formatAttendanceStatus(record.status),
        ]);
        title = `Laporan Cuti (${startDate} s.d ${endDate})`;
      } else if (reportType === "overtime") {
        const { data: overtimeData, error: overtimeError } = await supabase
          .from("overtime_requests")
          .select("*")
          .gte("overtime_date", startDate)
          .lte("overtime_date", endDate);

        if (overtimeError) throw overtimeError;

        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, departemen, nik");

        if (profilesError) throw profilesError;

        const profilesMap = new Map(profiles?.map((p) => [p.id, p]) || []);

        // Exclude admin users from overtime PDF report
        let mergedData =
          overtimeData
            ?.filter((record) => !adminUserIds.has(record.user_id))
            ?.map((record) => ({
              ...record,
              profiles: profilesMap.get(record.user_id),
            }))
            .filter((record) => record.profiles) || [];

        if (department !== "all") {
          mergedData = mergedData.filter((record) => record.profiles?.departemen === department);
        }

        columns = ["NIK", "Name", "Department", "Date", "Hours", "Status", "Reason"];
        data = mergedData.map((record: any) => [
          record.profiles?.nik || "-",
          record.profiles?.full_name || "-",
          record.profiles?.departemen || "-",
          record.overtime_date,
          record.hours,
          formatAttendanceStatus(record.status),
          record.reason,
        ]);
        title = `Laporan Lembur (${startDate} s.d ${endDate})`;
      } else if (reportType === "business_travel") {
        const { data: travelData, error: travelError } = await supabase
          .from("business_travel_requests")
          .select("*")
          .gte("start_date", startDate)
          .lte("end_date", endDate);

        if (travelError) throw travelError;

        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, departemen, nik");

        if (profilesError) throw profilesError;

        const profilesMap = new Map(profiles?.map((p) => [p.id, p]) || []);

        // Exclude admin users from business travel PDF report
        let mergedData =
          travelData
            ?.filter((record) => !adminUserIds.has(record.user_id))
            ?.map((record) => ({
              ...record,
              profiles: profilesMap.get(record.user_id),
            }))
            .filter((record) => record.profiles) || [];

        if (department !== "all") {
          mergedData = mergedData.filter((record) => record.profiles?.departemen === department);
        }

        columns = ["NIK", "Name", "Department", "Destination", "Purpose", "Start", "End", "Days", "Status"];
        data = mergedData.map((record: any) => [
          record.profiles?.nik || "-",
          record.profiles?.full_name || "-",
          record.profiles?.departemen || "-",
          record.destination,
          record.purpose,
          record.start_date,
          record.end_date,
          record.total_days,
          formatAttendanceStatus(record.status),
        ]);
        title = `Laporan Perjalanan Dinas (${startDate} s.d ${endDate})`;
      }

      const doc = new jsPDF();

      // Add logo
      try {
        const logoBase64 = await loadImageAsBase64(logoImage);
        doc.addImage(logoBase64, "PNG", 14, 10, 30, 12);
      } catch (e) {
        console.log("Could not load logo");
      }

      doc.setFontSize(16);
      doc.text(title, 50, 18);
      doc.setFontSize(10);
      doc.text(`Dibuat: ${format(new Date(), "yyyy-MM-dd HH:mm")}`, 50, 25);

      autoTable(doc, {
        head: [columns],
        body: data,
        startY: 32,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [0, 135, 81] },
      });

      doc.save(`${reportType}_report_${format(new Date(), "yyyy-MM-dd")}.pdf`);
      toast({ title: "Berhasil", description: "Laporan berhasil diekspor ke PDF" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Laporan & Analytics</h1>
          <p className="text-muted-foreground mt-1">Buat dan ekspor laporan absensi, cuti, dan data karyawan</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Laporan Umum</CardTitle>
              <CardDescription>Export laporan absensi, cuti, dan database karyawan</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Gunakan form di bawah untuk menghasilkan laporan berdasarkan rentang tanggal dan departemen
              </p>
            </CardContent>
          </Card>

          <Card
            className="border-primary/20 hover:border-primary/40 transition-colors cursor-pointer"
            onClick={() => navigate("/dashboard/reports/employee")}
          >
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                <CardTitle>Laporan Per Karyawan</CardTitle>
              </div>
              <CardDescription>Export data kehadiran untuk karyawan individual</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Pilih karyawan tertentu dan hasilkan laporan kehadiran mereka dalam format Excel atau PDF
              </p>
              <Button variant="link" className="mt-2 p-0 h-auto">
                Buka Laporan Per Karyawan →
              </Button>
            </CardContent>
          </Card>

          <Card
            className="border-primary/20 hover:border-primary/40 transition-colors cursor-pointer"
            onClick={() => navigate("/dashboard/reports/attendance-allowance")}
          >
            <CardHeader>
              <div className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-primary" />
                <CardTitle>Tunjangan Kehadiran</CardTitle>
              </div>
              <CardDescription>Perhitungan tunjangan kehadiran bulanan</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Hitung tunjangan kehadiran berdasarkan data absensi dengan potongan keterlambatan otomatis
              </p>
              <Button variant="link" className="mt-2 p-0 h-auto">
                Buka Laporan Tunjangan →
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Konfigurasi Laporan</CardTitle>
            <CardDescription>Pilih jenis laporan dan filter</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="reportType">Jenis Laporan</Label>
                <Select value={reportType} onValueChange={(value: any) => setReportType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="attendance">Laporan Absensi</SelectItem>
                    <SelectItem value="leave">Laporan Cuti</SelectItem>
                    <SelectItem value="overtime">Laporan Lembur</SelectItem>
                    <SelectItem value="business_travel">Laporan Perjalanan Dinas</SelectItem>
                    <SelectItem value="employees">Database Karyawan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Departemen</Label>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Departemen</SelectItem>
                    {DEPARTMENT_OPTIONS.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {reportType !== "employees" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Tanggal Mulai</Label>
                  <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">Tanggal Akhir</Label>
                  <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button
                onClick={exportToExcel}
                disabled={loading || (reportType !== "employees" && (!startDate || !endDate))}
                className="bg-primary hover:bg-primary/90"
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                )}
                Export ke Excel
              </Button>
              {reportType !== "employees" && (
                <Button onClick={exportToPDF} disabled={loading || !startDate || !endDate} variant="outline">
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                  Export ke PDF
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
