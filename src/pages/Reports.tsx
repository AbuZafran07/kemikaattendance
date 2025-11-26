import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

export default function Reports() {
  const { toast } = useToast();
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
        const query = supabase
          .from("attendance")
          .select(`
            *,
            profiles!inner(full_name, departemen, nik)
          `)
          .gte("check_in_time", startDate)
          .lte("check_in_time", endDate);

        if (department !== "all") {
          query.eq("profiles.departemen", department);
        }

        const { data: attendanceData, error } = await query;
        if (error) throw error;

        data = attendanceData.map((record: any) => ({
          NIK: record.profiles.nik,
          Name: record.profiles.full_name,
          Department: record.profiles.departemen,
          "Check In": format(new Date(record.check_in_time), "yyyy-MM-dd HH:mm"),
          "Check Out": record.check_out_time ? format(new Date(record.check_out_time), "yyyy-MM-dd HH:mm") : "-",
          Status: record.status,
          "Duration (min)": record.duration_minutes || "-",
        }));
        filename = `Attendance_Report_${startDate}_to_${endDate}.xlsx`;
      } else if (reportType === "leave") {
        const query = supabase
          .from("leave_requests")
          .select(`
            *,
            profiles!inner(full_name, departemen, nik)
          `)
          .gte("start_date", startDate)
          .lte("end_date", endDate);

        if (department !== "all") {
          query.eq("profiles.departemen", department);
        }

        const { data: leaveData, error } = await query;
        if (error) throw error;

        data = leaveData.map((record: any) => ({
          NIK: record.profiles.nik,
          Name: record.profiles.full_name,
          Department: record.profiles.departemen,
          "Leave Type": record.leave_type,
          "Start Date": record.start_date,
          "End Date": record.end_date,
          "Total Days": record.total_days,
          Status: record.status,
          Reason: record.reason,
        }));
        filename = `Leave_Report_${startDate}_to_${endDate}.xlsx`;
      } else {
        const query = supabase
          .from("profiles")
          .select("*");

        if (department !== "all") {
          query.eq("departemen", department);
        }

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
      XLSX.utils.book_append_sheet(wb, ws, reportType === "attendance" ? "Attendance" : reportType === "leave" ? "Leave" : "Employees");
      XLSX.writeFile(wb, filename);

      toast({
        title: "Success",
        description: "Report exported to Excel successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
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
        const query = supabase
          .from("attendance")
          .select(`
            *,
            profiles!inner(full_name, departemen, nik)
          `)
          .gte("check_in_time", startDate)
          .lte("check_in_time", endDate);

        if (department !== "all") {
          query.eq("profiles.departemen", department);
        }

        const { data: attendanceData, error } = await query;
        if (error) throw error;

        columns = ["NIK", "Name", "Department", "Check In", "Check Out", "Status"];
        data = attendanceData.map((record: any) => [
          record.profiles.nik,
          record.profiles.full_name,
          record.profiles.departemen,
          format(new Date(record.check_in_time), "yyyy-MM-dd HH:mm"),
          record.check_out_time ? format(new Date(record.check_out_time), "yyyy-MM-dd HH:mm") : "-",
          record.status,
        ]);
        title = `Attendance Report: ${startDate} to ${endDate}`;
      } else {
        const query = supabase
          .from("leave_requests")
          .select(`
            *,
            profiles!inner(full_name, departemen, nik)
          `)
          .gte("start_date", startDate)
          .lte("end_date", endDate);

        if (department !== "all") {
          query.eq("profiles.departemen", department);
        }

        const { data: leaveData, error } = await query;
        if (error) throw error;

        columns = ["NIK", "Name", "Leave Type", "Start", "End", "Days", "Status"];
        data = leaveData.map((record: any) => [
          record.profiles.nik,
          record.profiles.full_name,
          record.leave_type,
          record.start_date,
          record.end_date,
          record.total_days,
          record.status,
        ]);
        title = `Leave Report: ${startDate} to ${endDate}`;
      }

      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text(title, 14, 15);
      doc.setFontSize(10);
      doc.text(`Generated: ${format(new Date(), "yyyy-MM-dd HH:mm")}`, 14, 22);

      autoTable(doc, {
        head: [columns],
        body: data,
        startY: 28,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [0, 71, 171] },
      });

      doc.save(`${reportType}_report_${format(new Date(), "yyyy-MM-dd")}.pdf`);

      toast({
        title: "Success",
        description: "Report exported to PDF successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reports & Analytics</h1>
        <p className="text-muted-foreground">Generate and export attendance, leave, and employee reports</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report Configuration</CardTitle>
          <CardDescription>Select report type and filters</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="reportType">Report Type</Label>
              <Select value={reportType} onValueChange={(value: any) => setReportType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="attendance">Attendance Report</SelectItem>
                  <SelectItem value="leave">Leave Report</SelectItem>
                  <SelectItem value="employees">Employee Database</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="department">Department</Label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  <SelectItem value="HR">HR</SelectItem>
                  <SelectItem value="IT">IT</SelectItem>
                  <SelectItem value="Finance">Finance</SelectItem>
                  <SelectItem value="Operations">Operations</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {reportType !== "employees" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button onClick={exportToExcel} disabled={loading || (reportType !== "employees" && (!startDate || !endDate))}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
              Export to Excel
            </Button>
            {reportType !== "employees" && (
              <Button onClick={exportToPDF} disabled={loading || !startDate || !endDate} variant="outline">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                Export to PDF
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
