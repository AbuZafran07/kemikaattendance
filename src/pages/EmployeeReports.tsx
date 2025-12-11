import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Download, FileSpreadsheet, FileText, Loader2, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import logoImage from "@/assets/logo.png";
import { formatAttendanceStatus } from "@/lib/statusUtils";

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

export default function EmployeeReports() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, nik, departemen")
      .order("full_name");
    
    if (data) {
      setEmployees(data);
    }
  };

  const exportToExcel = async () => {
    if (!selectedEmployee || !startDate || !endDate) {
      toast({
        title: "Data Belum Lengkap",
        description: "Pilih karyawan dan rentang tanggal terlebih dahulu",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Get employee info
      const employee = employees.find(e => e.id === selectedEmployee);
      
      // Fetch attendance data
      const { data: attendanceData, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", selectedEmployee)
        .gte("check_in_time", `${startDate}T00:00:00`)
        .lte("check_in_time", `${endDate}T23:59:59`)
        .order("check_in_time", { ascending: false });

      if (error) throw error;

      // Fetch approved leave requests for this employee
      const { data: leaveData } = await supabase
        .from("leave_requests")
        .select("*")
        .eq("user_id", selectedEmployee)
        .eq("status", "approved")
        .gte("start_date", startDate)
        .lte("end_date", endDate);

      // Fetch approved business travel requests for this employee
      const { data: travelData } = await supabase
        .from("business_travel_requests")
        .select("*")
        .eq("user_id", selectedEmployee)
        .eq("status", "approved")
        .gte("start_date", startDate)
        .lte("end_date", endDate);

      // Format attendance data
      const formattedAttendance = (attendanceData || []).map((record: any) => ({
        Tanggal: format(new Date(record.check_in_time), "yyyy-MM-dd"),
        "Check In": format(new Date(record.check_in_time), "HH:mm:ss"),
        "Check Out": record.check_out_time ? format(new Date(record.check_out_time), "HH:mm:ss") : "-",
        "Durasi (menit)": record.duration_minutes || "-",
        Status: formatAttendanceStatus(record.status),
        Keterangan: record.notes || "-",
      }));

      // Format leave data as attendance entries
      const formattedLeave: any[] = [];
      (leaveData || []).forEach((leave: any) => {
        const start = new Date(leave.start_date);
        const end = new Date(leave.end_date);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          formattedLeave.push({
            Tanggal: format(new Date(d), "yyyy-MM-dd"),
            "Check In": "-",
            "Check Out": "-",
            "Durasi (menit)": "-",
            Status: formatAttendanceStatus(leave.leave_type),
            Keterangan: leave.reason || "-",
          });
        }
      });

      // Format business travel data as attendance entries
      const formattedTravel: any[] = [];
      (travelData || []).forEach((travel: any) => {
        const start = new Date(travel.start_date);
        const end = new Date(travel.end_date);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          formattedTravel.push({
            Tanggal: format(new Date(d), "yyyy-MM-dd"),
            "Check In": "-",
            "Check Out": "-",
            "Durasi (menit)": "-",
            Status: formatAttendanceStatus("dinas"),
            Keterangan: `${travel.destination} - ${travel.purpose}`,
          });
        }
      });

      // Combine and sort all data by date
      const allData = [...formattedAttendance, ...formattedLeave, ...formattedTravel]
        .sort((a, b) => b.Tanggal.localeCompare(a.Tanggal));

      if (allData.length === 0) {
        toast({
          title: "Tidak Ada Data",
          description: "Tidak ada data kehadiran untuk periode yang dipilih",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Create workbook
      const ws = XLSX.utils.json_to_sheet(allData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Kehadiran");

      // Add employee info at the top
      XLSX.utils.sheet_add_aoa(ws, [
        [`Laporan Kehadiran: ${employee?.full_name}`],
        [`NIK: ${employee?.nik}`],
        [`Departemen: ${employee?.departemen}`],
        [`Periode: ${startDate} s/d ${endDate}`],
        [],
      ], { origin: "A1" });

      // Adjust the data starting row
      const dataRange = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      dataRange.s.r = 5;
      ws['!ref'] = XLSX.utils.encode_range(dataRange);

      // Download
      XLSX.writeFile(wb, `Kehadiran_${employee?.full_name}_${startDate}_${endDate}.xlsx`);

      toast({
        title: "Export Berhasil",
        description: "File Excel berhasil diunduh",
      });
    } catch (error: any) {
      console.error("Export error:", error);
      toast({
        title: "Export Gagal",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = async () => {
    if (!selectedEmployee || !startDate || !endDate) {
      toast({
        title: "Data Belum Lengkap",
        description: "Pilih karyawan dan rentang tanggal terlebih dahulu",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Get employee info
      const employee = employees.find(e => e.id === selectedEmployee);
      
      // Fetch attendance data
      const { data: attendanceData, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", selectedEmployee)
        .gte("check_in_time", `${startDate}T00:00:00`)
        .lte("check_in_time", `${endDate}T23:59:59`)
        .order("check_in_time", { ascending: false });

      if (error) throw error;

      // Fetch approved leave requests for this employee
      const { data: leaveData } = await supabase
        .from("leave_requests")
        .select("*")
        .eq("user_id", selectedEmployee)
        .eq("status", "approved")
        .gte("start_date", startDate)
        .lte("end_date", endDate);

      // Fetch approved business travel requests for this employee
      const { data: travelData } = await supabase
        .from("business_travel_requests")
        .select("*")
        .eq("user_id", selectedEmployee)
        .eq("status", "approved")
        .gte("start_date", startDate)
        .lte("end_date", endDate);

      // Format attendance data for table
      const formattedAttendance = (attendanceData || []).map((record: any) => ({
        tanggal: format(new Date(record.check_in_time), "yyyy-MM-dd"),
        checkIn: format(new Date(record.check_in_time), "HH:mm:ss"),
        checkOut: record.check_out_time ? format(new Date(record.check_out_time), "HH:mm:ss") : "-",
        durasi: record.duration_minutes ? `${record.duration_minutes} min` : "-",
        status: formatAttendanceStatus(record.status),
        keterangan: record.notes || "-",
      }));

      // Format leave data as attendance entries
      const formattedLeave: any[] = [];
      (leaveData || []).forEach((leave: any) => {
        const start = new Date(leave.start_date);
        const end = new Date(leave.end_date);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          formattedLeave.push({
            tanggal: format(new Date(d), "yyyy-MM-dd"),
            checkIn: "-",
            checkOut: "-",
            durasi: "-",
            status: formatAttendanceStatus(leave.leave_type),
            keterangan: leave.reason || "-",
          });
        }
      });

      // Format business travel data as attendance entries
      const formattedTravel: any[] = [];
      (travelData || []).forEach((travel: any) => {
        const start = new Date(travel.start_date);
        const end = new Date(travel.end_date);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          formattedTravel.push({
            tanggal: format(new Date(d), "yyyy-MM-dd"),
            checkIn: "-",
            checkOut: "-",
            durasi: "-",
            status: formatAttendanceStatus("dinas"),
            keterangan: `${travel.destination} - ${travel.purpose}`,
          });
        }
      });

      // Combine and sort all data by date
      const allData = [...formattedAttendance, ...formattedLeave, ...formattedTravel]
        .sort((a, b) => b.tanggal.localeCompare(a.tanggal));

      if (allData.length === 0) {
        toast({
          title: "Tidak Ada Data",
          description: "Tidak ada data kehadiran untuk periode yang dipilih",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Create PDF
      const doc = new jsPDF();
      
      // Add logo
      try {
        const logoBase64 = await loadImageAsBase64(logoImage);
        doc.addImage(logoBase64, "PNG", 14, 10, 30, 12);
      } catch (e) {
        console.log("Could not load logo");
      }
      
      // Title and employee info
      doc.setFontSize(16);
      doc.text("Laporan Kehadiran Karyawan", 50, 18);
      
      doc.setFontSize(10);
      doc.text(`Nama: ${employee?.full_name}`, 14, 30);
      doc.text(`NIK: ${employee?.nik}`, 14, 35);
      doc.text(`Departemen: ${employee?.departemen}`, 14, 40);
      doc.text(`Periode: ${startDate} s/d ${endDate}`, 14, 45);

      // Summary statistics
      const totalHadir = (attendanceData || []).filter(r => r.status === 'hadir').length;
      const totalTerlambat = (attendanceData || []).filter(r => r.status === 'terlambat').length;
      const totalPulangCepat = (attendanceData || []).filter(r => r.status === 'pulang_cepat').length;
      const totalCuti = formattedLeave.length;
      const totalDinas = formattedTravel.length;
      const totalDuration = (attendanceData || []).reduce((sum, r) => sum + (r.duration_minutes || 0), 0);
      
      doc.text(`Total Kehadiran: ${(attendanceData || []).length} hari | Cuti: ${totalCuti} hari | Dinas: ${totalDinas} hari`, 14, 55);
      doc.text(`Hadir Tepat Waktu: ${totalHadir} | Terlambat: ${totalTerlambat} | Pulang Cepat: ${totalPulangCepat}`, 14, 60);
      doc.text(`Total Jam Kerja: ${Math.floor(totalDuration / 60)} jam ${totalDuration % 60} menit`, 14, 65);

      // Table
      const tableData = allData.map((record: any) => [
        record.tanggal,
        record.checkIn,
        record.checkOut,
        record.durasi,
        record.status,
        record.keterangan,
      ]);

      autoTable(doc, {
        head: [["Tanggal", "Check In", "Check Out", "Durasi", "Status", "Keterangan"]],
        body: tableData,
        startY: 75,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [0, 135, 81] },
      });

      // Download
      doc.save(`Kehadiran_${employee?.full_name}_${startDate}_${endDate}.pdf`);

      toast({
        title: "Export Berhasil",
        description: "File PDF berhasil diunduh",
      });
    } catch (error: any) {
      console.error("Export error:", error);
      toast({
        title: "Export Gagal",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/reports')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Laporan Kehadiran per Karyawan</h1>
            <p className="text-muted-foreground mt-1">
              Export data kehadiran karyawan dalam format Excel atau PDF
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Konfigurasi Laporan</CardTitle>
            <CardDescription>
              Pilih karyawan dan rentang tanggal untuk menghasilkan laporan
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="employee">Pilih Karyawan</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger id="employee">
                  <SelectValue placeholder="Pilih karyawan..." />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.nik}) - {emp.departemen}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Tanggal Mulai</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end-date">Tanggal Akhir</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={exportToExcel}
                disabled={loading || !selectedEmployee || !startDate || !endDate}
                className="flex-1"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                )}
                Export ke Excel
              </Button>

              <Button
                onClick={exportToPDF}
                disabled={loading || !selectedEmployee || !startDate || !endDate}
                variant="outline"
                className="flex-1"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                Export ke PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
