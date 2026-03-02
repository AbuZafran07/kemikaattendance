import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";
import {
  LogIn,
  Clock,
  CalendarDays,
  Wallet,
  MapPin,
  Fingerprint,
  BarChart3,
} from "lucide-react";

const quickLinks = [
  { icon: Fingerprint, label: "Absensi", desc: "Check-in & Check-out" },
  { icon: CalendarDays, label: "Cuti & Izin", desc: "Pengajuan & Riwayat" },
  { icon: Clock, label: "Lembur", desc: "Pengajuan Lembur" },
  { icon: Wallet, label: "Payroll", desc: "Slip Gaji & Riwayat" },
  { icon: MapPin, label: "Perjalanan Dinas", desc: "Pengajuan & Tracking" },
  { icon: BarChart3, label: "Laporan", desc: "Kehadiran & Kinerja" },
];

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Kemika Logo" className="h-10 object-contain" />
            <div>
              <p className="text-sm font-bold leading-tight text-foreground">PT KEMIKA</p>
              <p className="text-xs text-muted-foreground">Karya Pratama</p>
            </div>
          </div>
          <Button onClick={() => navigate("/login")} className="gap-2">
            <LogIn className="h-4 w-4" /> Masuk
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 sm:py-20">
        <div className="mx-auto w-full max-w-5xl">
          {/* Welcome */}
          <div className="text-center mb-12">
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl lg:text-4xl">
              Sistem Kehadiran & HR
            </h1>
            <p className="mt-2 text-muted-foreground text-base sm:text-lg">
              Portal internal karyawan PT Kemika Karya Pratama
            </p>
          </div>

          {/* Quick Access Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:gap-5">
            {quickLinks.map((item) => (
              <button
                key={item.label}
                onClick={() => navigate("/login")}
                className="group flex flex-col items-center gap-3 rounded-xl border border-border/50 bg-card p-5 sm:p-6 text-center transition-colors hover:border-primary/30 hover:bg-accent/50"
              >
                <div className="rounded-xl bg-primary/10 p-3 transition-colors group-hover:bg-primary/15">
                  <item.icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Login CTA */}
          <div className="mt-10 text-center">
            <p className="text-sm text-muted-foreground mb-3">
              Silakan masuk untuk mengakses sistem
            </p>
            <Button size="lg" onClick={() => navigate("/login")} className="gap-2">
              <LogIn className="h-4 w-4" /> Masuk ke Sistem
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 py-4">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 text-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} PT Kemika Karya Pratama — Internal Use Only
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
