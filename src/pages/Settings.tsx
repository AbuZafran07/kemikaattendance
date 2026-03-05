import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Clock, Calendar, FileText, Bell, CalendarClock, Coins, Landmark, Shield, Receipt } from "lucide-react";

export default function Settings() {
  const navigate = useNavigate();

  // ✅ Daftar menu pengaturan sistem
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
      title: "Jam Kerja Khusus",
      description: "Atur jam kerja untuk periode khusus (Ramadhan, event, dll)",
      icon: CalendarClock,
      path: "/dashboard/settings/special-work-hours",
    },
    {
      title: "Kebijakan Cuti",
      description: "Kelola kuota dan aturan cuti",
      icon: Calendar,
      path: "/dashboard/settings/leave", // ✅ konsisten: semua menu ada di /dashboard/settings/
    },
    {
      title: "Kebijakan Lembur",
      description: "Atur aturan dan kompensasi lembur",
      icon: FileText,
      path: "/dashboard/settings/overtime",
    },
    {
      title: "Tunjangan Kehadiran",
      description: "Konfigurasi perhitungan tunjangan kehadiran",
      icon: Coins,
      path: "/dashboard/settings/attendance-allowance",
    },
    {
      title: "Bank Perusahaan",
      description: "Atur rekening perusahaan untuk e-Payroll bank",
      icon: Landmark,
      path: "/dashboard/settings/company-bank",
    },
    {
      title: "Pengaturan BPJS",
      description: "Konfigurasi tarif BPJS Ketenagakerjaan & Kesehatan",
      icon: Shield,
      path: "/dashboard/settings/bpjs",
    },
    {
      title: "Pengaturan PTKP",
      description: "Kelola nilai Penghasilan Tidak Kena Pajak",
      icon: Receipt,
      path: "/dashboard/settings/ptkp",
    },
    {
      title: "Pengaturan Notifikasi",
      description: "Kelola notifikasi push untuk admin",
      icon: Bell,
      path: "/dashboard/settings/notifications",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6 animate-fadeIn">
        {/* Header */}
        <div className="px-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Pengaturan Sistem</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">Konfigurasi sistem dan pengaturan aplikasi</p>
        </div>

        {/* Grid Menu */}
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
          {settingsMenu.map((item) => {
            const Icon = item.icon;
            return (
              <Card
                key={item.title}
                onClick={() => navigate(item.path)}
                className="cursor-pointer border-primary/10 hover:border-primary/40 hover:shadow-md transition-all duration-200"
              >
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
                    {item.title}
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">{item.description}</CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
