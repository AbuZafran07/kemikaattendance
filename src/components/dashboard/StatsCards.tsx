import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, UserX, Clock, Timer, CalendarOff } from "lucide-react";

interface StatsCardsProps {
  stats: {
    totalEmployees: number;
    presentToday: number;
    absentToday: number;
    lateToday: number;
    earlyLeaveToday: number;
    pendingLeave: number;
    pendingOvertime: number;
    pendingTravel?: number;
    totalOvertimeHours: number;
  };
}

const StatsCards = ({ stats }: StatsCardsProps) => {
  const pendingTravel = stats.pendingTravel || 0;
  const totalPending = stats.pendingLeave + stats.pendingOvertime + pendingTravel;
  
  const statsData = [
    {
      title: "Total Karyawan",
      value: stats.totalEmployees.toString(),
      icon: Users,
      description: "Karyawan aktif",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Hadir Hari Ini",
      value: stats.presentToday.toString(),
      icon: UserCheck,
      description: `${stats.totalEmployees > 0 ? Math.round((stats.presentToday / stats.totalEmployees) * 100) : 0}% kehadiran`,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Terlambat",
      value: stats.lateToday.toString(),
      icon: Clock,
      description: `${stats.totalEmployees > 0 ? Math.round((stats.lateToday / stats.totalEmployees) * 100) : 0}% dari total`,
      color: "text-amber-600",
      bgColor: "bg-amber-100",
    },
    {
      title: "Pulang Cepat",
      value: stats.earlyLeaveToday.toString(),
      icon: Timer,
      description: "Hari ini",
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
    {
      title: "Tidak Hadir",
      value: stats.absentToday.toString(),
      icon: UserX,
      description: `${stats.totalEmployees > 0 ? Math.round((stats.absentToday / stats.totalEmployees) * 100) : 0}% dari total`,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
    },
    {
      title: "Pending",
      value: totalPending.toString(),
      icon: CalendarOff,
      description: `${stats.pendingLeave} cuti, ${stats.pendingOvertime} lembur${pendingTravel > 0 ? `, ${pendingTravel} dinas` : ''}`,
      color: "text-secondary",
      bgColor: "bg-secondary/10",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
      {statsData.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
            <div className={`p-2 rounded-full ${stat.bgColor}`}>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stat.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default StatsCards;
