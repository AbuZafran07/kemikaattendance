import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, CheckCircle2, XCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const Attendance = () => {
  const attendanceData = [
    {
      id: 1,
      name: "Ahmad Rizky",
      department: "Production",
      checkIn: "07:58",
      checkOut: "17:02",
      status: "Hadir",
      duration: "9h 4m",
      location: "Valid",
    },
    {
      id: 2,
      name: "Siti Nurhaliza",
      department: "HRGA",
      checkIn: "08:15",
      checkOut: "17:00",
      status: "Terlambat",
      duration: "8h 45m",
      location: "Valid",
    },
    {
      id: 3,
      name: "Budi Santoso",
      department: "QC",
      checkIn: "08:00",
      checkOut: "-",
      status: "Belum Check-out",
      duration: "-",
      location: "Valid",
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Hadir":
        return <Badge className="bg-primary">{status}</Badge>;
      case "Terlambat":
        return <Badge variant="secondary">{status}</Badge>;
      case "Belum Check-out":
        return <Badge variant="outline">{status}</Badge>;
      default:
        return <Badge variant="destructive">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Absensi Real-Time</h1>
          <p className="text-muted-foreground mt-1">
            Monitoring kehadiran karyawan hari ini
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Check-In
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <span className="text-3xl font-bold">142</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Terlambat
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-secondary" />
                <span className="text-3xl font-bold">6</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Belum Check-Out
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-muted-foreground" />
                <span className="text-3xl font-bold">12</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Data Absensi Hari Ini</CardTitle>
            <CardDescription>
              Kamis, 26 November 2025
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Departemen</TableHead>
                    <TableHead>Check-In</TableHead>
                    <TableHead>Check-Out</TableHead>
                    <TableHead>Durasi</TableHead>
                    <TableHead>Lokasi</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceData.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.name}</TableCell>
                      <TableCell>{record.department}</TableCell>
                      <TableCell className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {record.checkIn}
                      </TableCell>
                      <TableCell>{record.checkOut}</TableCell>
                      <TableCell>{record.duration}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4 text-primary" />
                          <span className="text-sm">{record.location}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(record.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Attendance;
