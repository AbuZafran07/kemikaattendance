import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import logo from "@/assets/logo.png";
import {
  LogIn,
  Clock,
  CalendarDays,
  Wallet,
  MapPin,
  Fingerprint,
  BarChart3,
  Megaphone,
  Info,
  ArrowRight,
} from "lucide-react";

const quickLinks = [
  { icon: Fingerprint, label: "Absensi", desc: "Check-in & Check-out harian" },
  { icon: CalendarDays, label: "Cuti & Izin", desc: "Pengajuan & riwayat cuti" },
  { icon: Clock, label: "Lembur", desc: "Pengajuan lembur kerja" },
  { icon: Wallet, label: "Payroll", desc: "Slip gaji & riwayat" },
  { icon: MapPin, label: "Perjalanan Dinas", desc: "Pengajuan & tracking" },
  { icon: BarChart3, label: "Laporan", desc: "Kehadiran & kinerja" },
];

const announcements = [
  {
    type: "info",
    title: "Pembaruan Sistem HR",
    message: "Sistem HR telah diperbarui ke versi terbaru dengan fitur absensi wajah dan GPS.",
    date: "2 Mar 2026",
  },
  {
    type: "warning",
    title: "Pengingat Pengajuan Cuti",
    message: "Harap ajukan cuti minimal 3 hari kerja sebelum tanggal cuti yang diinginkan.",
    date: "28 Feb 2026",
  },
  {
    type: "info",
    title: "Jadwal Libur Nasional",
    message: "Hari libur nasional bulan Maret telah diperbarui di sistem. Silakan cek kalender.",
    date: "25 Feb 2026",
  },
];

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Kemika Logo" className="h-10 object-contain" />
            <div>
              <p className="text-sm font-bold leading-tight text-foreground">PT KEMIKA</p>
              <p className="text-xs text-muted-foreground">Karya Pratama</p>
            </div>
          </div>
          <Button onClick={() => navigate("/login")} size="sm" className="gap-2">
            <LogIn className="h-4 w-4" /> Masuk
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/20" />
        <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
          <div className="text-center max-w-2xl mx-auto">
            <Badge variant="secondary" className="mb-4 px-3 py-1 text-xs">
              Portal Internal Karyawan
            </Badge>
            <h1 className="text-3xl font-bold text-foreground sm:text-4xl lg:text-5xl tracking-tight">
              Sistem Kehadiran & HR
            </h1>
            <p className="mt-3 text-muted-foreground text-base sm:text-lg max-w-lg mx-auto">
              Kelola absensi, cuti, lembur, dan payroll Anda dalam satu platform terpadu.
            </p>
            <div className="mt-6">
              <Button size="lg" onClick={() => navigate("/login")} className="gap-2 px-8">
                <LogIn className="h-4 w-4" /> Masuk ke Sistem
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="flex-1 px-4 pb-12 sm:px-6">
        <div className="mx-auto max-w-6xl -mt-4">
          {/* Quick Access Grid */}
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-5">
              <div className="h-1 w-1 rounded-full bg-primary" />
              <h2 className="text-lg font-semibold text-foreground">Akses Cepat</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 sm:gap-4">
              {quickLinks.map((item) => (
                <button
                  key={item.label}
                  onClick={() => navigate("/login")}
                  className="group flex flex-col items-center gap-3 rounded-xl border border-border/60 bg-card p-5 text-center transition-all duration-200 hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5"
                >
                  <div className="rounded-xl bg-primary/10 p-3 transition-colors group-hover:bg-primary/20">
                    <item.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{item.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Announcements */}
          <section>
            <div className="flex items-center gap-2 mb-5">
              <Megaphone className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Pengumuman & Informasi</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {announcements.map((item, idx) => (
                <Card key={idx} className="border-border/60 hover:border-primary/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 rounded-lg p-2 ${
                        item.type === "warning"
                          ? "bg-destructive/10"
                          : "bg-primary/10"
                      }`}>
                        <Info className={`h-4 w-4 ${
                          item.type === "warning"
                            ? "text-destructive"
                            : "text-primary"
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-sm font-semibold text-foreground truncate">{item.title}</p>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{item.message}</p>
                        <p className="text-[11px] text-muted-foreground/70 mt-2">{item.date}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-card/50 py-5">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 text-center space-y-1">
          <p className="text-xs text-muted-foreground font-medium">
            PT Kemika Karya Pratama
          </p>
          <p className="text-[11px] text-muted-foreground/70">
            © {new Date().getFullYear()} — Internal Use Only
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
