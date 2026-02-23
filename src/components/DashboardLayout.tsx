import { ReactNode } from "react";
import { NavLink } from "@/components/NavLink";
import { 
  LayoutDashboard, 
  Users, 
  ClipboardCheck, 
  Calendar, 
  Clock, 
  FileText, 
  Bell, 
  Settings,
  LogOut,
  Menu,
  Plane
} from "lucide-react";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";

interface DashboardLayoutProps {
  children: ReactNode;
}

const navigationGroups = [
  {
    label: "RINGKASAN",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "MANAJEMEN",
    items: [
      { name: "Karyawan", href: "/dashboard/employees", icon: Users },
      { name: "Absensi", href: "/dashboard/attendance", icon: ClipboardCheck },
      { name: "Cuti", href: "/dashboard/leave", icon: Calendar },
      { name: "Lembur", href: "/dashboard/overtime", icon: Clock },
      { name: "Perjalanan Dinas", href: "/dashboard/business-travel", icon: Plane },
    ],
  },
  {
    label: "LAPORAN",
    items: [
      { name: "Laporan", href: "/dashboard/reports", icon: FileText },
      { name: "Notifikasi", href: "/dashboard/notifications", icon: Bell },
    ],
  },
  {
    label: "SISTEM",
    items: [
      { name: "Pengaturan", href: "/dashboard/settings", icon: Settings },
    ],
  },
];

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const { signOut, profile } = useAuth();

  const handleLogout = () => {
    signOut();
  };

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={`flex flex-col h-full bg-[hsl(161,93%,12%)] text-white ${mobile ? "" : ""}`}>
      {/* Logo & Company */}
      <div className="p-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Kemika" className="h-10 w-10 object-contain rounded-lg bg-white/10 p-1" />
          <div className="min-w-0">
            <h2 className="font-bold text-sm tracking-wide truncate">PT. KEMIKA KARYA PRATAMA</h2>
            <p className="text-[11px] text-white/60 truncate">Sistem Absensi & HR</p>
          </div>
        </div>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 py-3 px-3 space-y-4 overflow-y-auto">
        {navigationGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1.5 text-[10px] font-semibold tracking-widest text-white/40 uppercase">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  end={item.href === "/dashboard"}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors text-sm"
                  activeClassName="bg-primary text-white font-medium hover:bg-primary hover:text-white"
                >
                  <item.icon className="h-[18px] w-[18px] flex-shrink-0" />
                  <span>{item.name}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-colors text-sm"
        >
          <LogOut className="h-[18px] w-[18px]" />
          <span>Keluar</span>
        </button>
        <p className="text-[10px] text-white/30 text-center mt-3">© 2026 PT. Kemika Karya Pratama</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-[250px] flex-shrink-0">
        <Sidebar />
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-[hsl(161,93%,12%)] flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-2">
          <img src={logo} alt="Kemika" className="h-8 w-8 object-contain rounded bg-white/10 p-0.5" />
          <span className="text-white font-semibold text-sm">KEMIKA</span>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[250px] p-0 border-0">
            <Sidebar mobile />
          </SheetContent>
        </Sheet>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
        {/* Top Bar */}
        <div className="hidden lg:flex items-center justify-end h-14 px-6 border-b border-border bg-card">
          {profile && (
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-muted-foreground cursor-pointer hover:text-foreground transition-colors" />
              <div className="text-right">
                <p className="text-sm font-medium leading-tight">{profile.full_name}</p>
                <p className="text-[11px] text-muted-foreground">{profile.jabatan}</p>
              </div>
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                {profile.full_name?.charAt(0) || "U"}
              </div>
            </div>
          )}
        </div>
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
