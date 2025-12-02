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

      if (!attendanceData || attendanceData.length === 0) {
        toast({
          title: "Tidak Ada Data",
          description: "Tidak ada data kehadiran untuk periode yang dipilih",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Format data for export
      const formattedData = attendanceData.map((record: any) => ({
        Tanggal: format(new Date(record.check_in_time), "yyyy-MM-dd"),
        "Check In": format(new Date(record.check_in_time), "HH:mm:ss"),
        "Check Out": record.check_out_time ? format(new Date(record.check_out_time), "HH:mm:ss") : "-",
        "Durasi (menit)": record.duration_minutes || "-",
        Status: record.status,
        "GPS Valid": record.gps_validated ? "Ya" : "Tidak",
        Catatan: record.notes || "-",
      }));

      // Create workbook
      const ws = XLSX.utils.json_to_sheet(formattedData);
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

      if (!attendanceData || attendanceData.length === 0) {
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
      
      // Title and employee info
      doc.setFontSize(16);
      doc.text("Laporan Kehadiran Karyawan", 14, 15);
      
      doc.setFontSize(10);
      doc.text(`Nama: ${employee?.full_name}`, 14, 25);
      doc.text(`NIK: ${employee?.nik}`, 14, 30);
      doc.text(`Departemen: ${employee?.departemen}`, 14, 35);
      doc.text(`Periode: ${startDate} s/d ${endDate}`, 14, 40);

      // Summary statistics
      const totalHadir = attendanceData.filter(r => r.status === 'hadir').length;
      const totalTerlambat = attendanceData.filter(r => r.status === 'terlambat').length;
      const totalPulangCepat = attendanceData.filter(r => r.status === 'pulang_cepat').length;
      const totalDuration = attendanceData.reduce((sum, r) => sum + (r.duration_minutes || 0), 0);
      
      doc.text(`Total Kehadiran: ${attendanceData.length} hari`, 14, 50);
      doc.text(`Hadir Tepat Waktu: ${totalHadir} | Terlambat: ${totalTerlambat} | Pulang Cepat: ${totalPulangCepat}`, 14, 55);
      doc.text(`Total Jam Kerja: ${Math.floor(totalDuration / 60)} jam ${totalDuration % 60} menit`, 14, 60);

      // Table
      const tableData = attendanceData.map((record: any) => [
        format(new Date(record.check_in_time), "yyyy-MM-dd"),
        format(new Date(record.check_in_time), "HH:mm:ss"),
        record.check_out_time ? format(new Date(record.check_out_time), "HH:mm:ss") : "-",
        record.duration_minutes ? `${record.duration_minutes} min` : "-",
        record.status,
      ]);

      autoTable(doc, {
        head: [["Tanggal", "Check In", "Check Out", "Durasi", "Status"]],
        body: tableData,
        startY: 70,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [0, 71, 171] },
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
