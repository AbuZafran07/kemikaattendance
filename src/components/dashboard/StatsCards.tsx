import { Card, CardContent } from "@/components/ui/card";
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
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
    },
    {
      title: "Hadir Hari Ini",
      value: stats.presentToday.toString(),
      icon: UserCheck,
      description: `${stats.totalEmployees > 0 ? Math.round((stats.presentToday / stats.totalEmployees) * 100) : 0}% kehadiran`,
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
    },
    {
      title: "Terlambat",
      value: stats.lateToday.toString(),
      icon: Clock,
      description: `${stats.totalEmployees > 0 ? Math.round((stats.lateToday / stats.totalEmployees) * 100) : 0}% dari total`,
      iconBg: "bg-accent",
      iconColor: "text-accent-foreground",
    },
    {
      title: "Pulang Cepat",
      value: stats.earlyLeaveToday.toString(),
      icon: Timer,
      description: "Hari ini",
      iconBg: "bg-accent",
      iconColor: "text-accent-foreground",
    },
    {
      title: "Tidak Hadir",
      value: stats.absentToday.toString(),
      icon: UserX,
      description: `${stats.totalEmployees > 0 ? Math.round((stats.absentToday / stats.totalEmployees) * 100) : 0}% dari total`,
      iconBg: "bg-destructive/10",
      iconColor: "text-destructive",
    },
    {
      title: "Pending",
      value: totalPending.toString(),
      icon: CalendarOff,
      description: `${stats.pendingLeave} cuti, ${stats.pendingOvertime} lembur${pendingTravel > 0 ? `, ${pendingTravel} dinas` : ''}`,
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
    },
  ];

  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
      {statsData.map((stat) => (
        <Card key={stat.title} className="border border-border/50 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-medium text-muted-foreground leading-tight">{stat.title}</p>
              <div className={`p-2 rounded-lg ${stat.iconBg}`}>
                <stat.icon className={`h-4 w-4 ${stat.iconColor}`} />
              </div>
            </div>
            <div className="text-2xl font-bold tracking-tight">{stat.value}</div>
            <p className="text-[11px] text-muted-foreground mt-1">{stat.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default StatsCards;
