import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Download, FileSpreadsheet, FileText, Loader2, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { DEPARTMENT_OPTIONS } from "@/lib/employeeOptions";

export default function Reports() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState<"attendance" | "leave" | "employees">("attendance");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [department, setDepartment] = useState<string>("all");

  const exportToExcel = async () => {
    setLoading(true);
    try {
      let data: any[] = [];
      let filename = "";

      if (reportType === "attendance") {
        const { data: attendanceData, error: attendanceError } = await supabase
          .from("attendance")
          .select("*")
          .gte("check_in_time", `${startDate}T00:00:00`)
          .lte("check_in_time", `${endDate}T23:59:59`);

        if (attendanceError) throw attendanceError;

        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, departemen, nik");

        if (profilesError) throw profilesError;

        const profilesMap = new Map(profiles?.map((p) => [p.id, p]) || []);

        let mergedData =
          attendanceData
            ?.map((record) => ({
              ...record,
              profiles: profilesMap.get(record.user_id),
            }))
            .filter((record) => record.profiles) || [];

        if (department !== "all") {
          mergedData = mergedData.filter((record) => record.profiles?.departemen === department);
        }

        data = mergedData.map((record: any) => {
          const checkIn = new Date(record.check_in_time);
          const checkOut = record.check_out_time ? new Date(record.check_out_time) : null;
          return {
            Date: format(checkIn, "yyyy-MM-dd"),
            NIK: record.profiles?.nik || "-",
            Name: record.profiles?.full_name || "-",
            Department: record.profiles?.departemen || "-",
            "Check In Time": format(checkIn, "HH:mm"),
            "Check Out Time": checkOut ? format(checkOut, "HH:mm") : "-",
            Status: record.status,
            "Duration (min)": record.duration_minutes || "-",
          };
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

        let mergedData =
          leaveData
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
          "Leave Type": record.leave_type,
          "Start Date": record.start_date,
          "End Date": record.end_date,
          "Total Days": record.total_days,
          Status: record.status,
          Reason: record.reason,
        }));
        filename = `Leave_Report_${startDate}_to_${endDate}.xlsx`;
      } else {
        let query = supabase.from("profiles").select("*");
        if (department !== "all") query = query.eq("departemen", department);

        const { data: employeeData, error } = await query;
        if (error) throw error;

        data = employeeData.map((emp: any) => ({
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

      if (reportType === "attendance") {
        const { data: attendanceData, error: attendanceError } = await supabase
          .from("attendance")
          .select("*")
          .gte("check_in_time", `${startDate}T00:00:00`)
          .lte("check_in_time", `${endDate}T23:59:59`);

        if (attendanceError) throw attendanceError;

        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, departemen, nik");

        if (profilesError) throw profilesError;

        const profilesMap = new Map(profiles?.map((p) => [p.id, p]) || []);

        let mergedData =
          attendanceData
            ?.map((record) => ({
              ...record,
              profiles: profilesMap.get(record.user_id),
            }))
            .filter((record) => record.profiles) || [];

        if (department !== "all") {
          mergedData = mergedData.filter((record) => record.profiles?.departemen === department);
        }

        columns = ["Date", "NIK", "Name", "Department", "Check In", "Check Out", "Status"];
        data = mergedData.map((record: any) => {
          const checkIn = new Date(record.check_in_time);
          const checkOut = record.check_out_time ? new Date(record.check_out_time) : null;
          return [
            format(checkIn, "yyyy-MM-dd"),
            record.profiles?.nik || "-",
            record.profiles?.full_name || "-",
            record.profiles?.departemen || "-",
            format(checkIn, "HH:mm"),
            checkOut ? format(checkOut, "HH:mm") : "-",
            record.status,
          ];
        });
        title = `Laporan Absensi (${startDate} s.d ${endDate})`;
      } else {
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

        let mergedData =
          leaveData
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
          record.leave_type,
          record.start_date,
          record.end_date,
          record.total_days,
          record.status,
        ]);
        title = `Laporan Cuti (${startDate} s.d ${endDate})`;
      }

      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text(title, 14, 15);
      doc.setFontSize(10);
      doc.text(`Dibuat: ${format(new Date(), "yyyy-MM-dd HH:mm")}`, 14, 22);

      autoTable(doc, {
        head: [columns],
        body: data,
        startY: 28,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [0, 71, 171] },
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
