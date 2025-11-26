import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, UserX, Clock } from "lucide-react";

const Dashboard = () => {
  const stats = [
    {
      title: "Total Karyawan",
      value: "156",
      icon: Users,
      description: "Karyawan aktif",
      color: "text-primary",
    },
    {
      title: "Hadir Hari Ini",
      value: "142",
      icon: UserCheck,
      description: "91% kehadiran",
      color: "text-primary",
    },
    {
      title: "Tidak Hadir",
      value: "8",
      icon: UserX,
      description: "5% dari total",
      color: "text-destructive",
    },
    {
      title: "Terlambat",
      value: "6",
      icon: Clock,
      description: "4% dari hadir",
      color: "text-secondary",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Selamat datang di Kemika HR Attendance System
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Absensi Real-Time</CardTitle>
              <CardDescription>
                Monitoring kehadiran karyawan hari ini
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <UserCheck className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Karyawan {i}</p>
                      <p className="text-sm text-muted-foreground">Check-in: 08:00</p>
                    </div>
                    <div className="text-sm text-primary font-medium">Tepat Waktu</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Permintaan Cuti Pending</CardTitle>
              <CardDescription>
                Menunggu approval dari HRGA
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between p-3 border border-border rounded-lg">
                    <div>
                      <p className="font-medium">Karyawan {i}</p>
                      <p className="text-sm text-muted-foreground">25 - 27 Nov 2025</p>
                    </div>
                    <div className="text-xs bg-secondary/10 text-secondary px-2 py-1 rounded">
                      Pending
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
