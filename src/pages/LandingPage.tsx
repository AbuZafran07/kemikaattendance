import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import logo from "@/assets/logo.png";
import {
  Clock,
  Users,
  MapPin,
  Shield,
  BarChart3,
  Smartphone,
  ChevronRight,
  CheckCircle2,
  Fingerprint,
  CalendarDays,
  Wallet,
  ArrowRight,
} from "lucide-react";

const features = [
  {
    icon: Fingerprint,
    title: "Face Recognition",
    description: "Absensi dengan pengenalan wajah untuk keamanan dan akurasi data kehadiran.",
  },
  {
    icon: MapPin,
    title: "GPS Validation",
    description: "Validasi lokasi karyawan saat melakukan check-in dan check-out secara real-time.",
  },
  {
    icon: CalendarDays,
    title: "Manajemen Cuti & Lembur",
    description: "Pengajuan dan persetujuan cuti, izin, dan lembur secara digital dan otomatis.",
  },
  {
    icon: Wallet,
    title: "Payroll Otomatis",
    description: "Perhitungan gaji, BPJS, PPh21, dan tunjangan terintegrasi dengan data kehadiran.",
  },
  {
    icon: BarChart3,
    title: "Laporan & Analitik",
    description: "Laporan kehadiran, kinerja, dan payroll dengan AI Insight untuk evaluasi cerdas.",
  },
  {
    icon: Smartphone,
    title: "Mobile Friendly",
    description: "Akses mudah dari smartphone untuk karyawan melakukan absensi dan pengajuan.",
  },
];

const benefits = [
  "Absensi real-time dengan foto & GPS",
  "Perhitungan PPh21 TER otomatis",
  "Manajemen pinjaman karyawan",
  "Notifikasi push real-time",
  "Export laporan PDF & Excel",
  "Tunjangan kehadiran otomatis",
];

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Kemika Logo" className="h-10 object-contain" />
            <div className="hidden sm:block">
              <p className="text-sm font-bold leading-tight text-foreground">PT KEMIKA</p>
              <p className="text-xs text-muted-foreground">Karya Pratama</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate("/login")}>
              Masuk
            </Button>
            <Button onClick={() => navigate("/login")} className="gap-2">
              Mulai <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/20" />
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }} />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-36">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
              <Shield className="h-4 w-4" />
              Sistem HR & Kehadiran Terintegrasi
            </div>
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Kelola Karyawan Lebih{" "}
              <span className="text-primary">Cerdas & Efisien</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
              Platform manajemen kehadiran dan HR all-in-one dengan face recognition, GPS tracking, payroll otomatis, dan AI insight — semua dalam satu aplikasi.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
              <Button size="lg" onClick={() => navigate("/login")} className="gap-2 text-base">
                Masuk Sekarang <ChevronRight className="h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => {
                document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
              }} className="text-base">
                Pelajari Fitur
              </Button>
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-primary" /> Real-time Tracking
              </span>
              <span className="flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-primary" /> Data Aman & Terenkripsi
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-primary" /> Multi-Role Access
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="border-t border-border/50 bg-card/50 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">Fitur Unggulan</p>
            <h2 className="mt-2 text-3xl font-bold text-foreground sm:text-4xl">
              Semua yang Anda Butuhkan untuk Manajemen HR
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Dari absensi hingga payroll, semua terintegrasi dalam satu platform modern.
            </p>
          </div>
          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} className="group border-border/50 transition-all hover:border-primary/30 hover:shadow-lg">
                <CardContent className="p-6">
                  <div className="mb-4 inline-flex rounded-xl bg-primary/10 p-3">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-primary">Keunggulan</p>
              <h2 className="mt-2 text-3xl font-bold text-foreground sm:text-4xl">
                Mengapa Memilih Kemika HR System?
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Dirancang khusus untuk kebutuhan perusahaan Indonesia dengan kalkulasi pajak dan BPJS yang akurat.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {benefits.map((benefit) => (
                  <div key={benefit} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <span className="text-sm text-foreground">{benefit}</span>
                  </div>
                ))}
              </div>
              <Button size="lg" className="mt-8 gap-2" onClick={() => navigate("/login")}>
                Mulai Sekarang <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
            <div className="relative">
              <div className="rounded-2xl border border-border/50 bg-card p-8 shadow-xl">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 rounded-xl bg-primary/5 p-4">
                    <div className="rounded-full bg-primary/10 p-2">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Total Karyawan Aktif</p>
                      <p className="text-2xl font-bold text-primary">150+</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl bg-accent/50 p-4">
                    <div className="rounded-full bg-primary/10 p-2">
                      <Clock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Kehadiran Hari Ini</p>
                      <p className="text-2xl font-bold text-accent-foreground">98.5%</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl bg-primary/5 p-4">
                    <div className="rounded-full bg-primary/10 p-2">
                      <BarChart3 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Payroll Terproses</p>
                      <p className="text-2xl font-bold text-primary">100%</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-border/50 bg-primary/5 py-16 sm:py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-foreground sm:text-4xl">
            Siap Mengelola HR Lebih Efisien?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Masuk ke sistem untuk mulai mengelola kehadiran, cuti, payroll, dan lainnya.
          </p>
          <Button size="lg" className="mt-8 gap-2 text-base" onClick={() => navigate("/login")}>
            Masuk ke Sistem <ArrowRight className="h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-card py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-3">
              <img src={logo} alt="Kemika Logo" className="h-8 object-contain" />
              <span className="text-sm font-semibold text-foreground">PT Kemika Karya Pratama</span>
            </div>
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} Kemika HR System. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
