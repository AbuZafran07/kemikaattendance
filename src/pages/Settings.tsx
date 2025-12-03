import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Clock, Calendar, FileText, Bell } from "lucide-react";

export default function Settings() {
  const navigate = useNavigate();

  // ✅ Semua menu dikumpulkan dalam 1 array supaya mudah tambah menu di masa depan
  const settingsMenu = [
    {
      title: "Lokasi Kantor",
      description: "Kelola lokasi dan koordinat GPS kantor",
      icon: Building2,
      path: "/dashboard/settings/office",
    },
    {
      title: "Jam Kerja",
      description: "Atur jam kerja dan toleransi keterlambatan",
      icon: Clock,
      path: "/dashboard/settings/work-hours",
    },
    {
      title: "Kebijakan Cuti",
      description: "Kelola kuota dan aturan cuti",
      icon: Calendar,
      path: "/dashboard/settings/leave",
    },
    {
      title: "Kebijakan Lembur",
      description: "Atur aturan dan kompensasi lembur",
      icon: FileText,
      path: "/dashboard/settings/overtime",
    },
    {
      title: "Pengaturan Notifikasi",
      description: "Kelola notifikasi push untuk admin",
      icon: Bell,
      path: "/dashboard/settings/notifications", // ✅ konsisten dengan route settings
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fadeIn">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pengaturan Sistem</h1>
          <p className="text-muted-foreground mt-1">Konfigurasi sistem dan pengaturan aplikasi</p>
        </div>

        {/* Grid Menu */}
        <div className="grid gap-4 md:grid-cols-2">
          {settingsMenu.map((item) => {
            const Icon = item.icon;
            return (
              <Card
                key={item.title}
                onClick={() => navigate(item.path)}
                className="cursor-pointer border-primary/10 hover:border-primary/30 hover:shadow-md transition-all duration-200"
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-primary" />
                    {item.title}
                  </CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
