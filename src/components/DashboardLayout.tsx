import { ReactNode, useState } from "react";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
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
  Plane,
  ChevronDown,
  UserCircle
} from "lucide-react";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const navigate = useNavigate();

  const handleLogout = () => {
    signOut();
  };

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex flex-col h-full bg-[hsl(161,80%,14%)] text-white">
      {/* Logo & Company */}
      <div className="p-5 border-b border-white/8">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Kemika" className="h-10 w-10 object-contain rounded-lg bg-white/10 p-1" />
          <div className="min-w-0">
            <h2 className="font-bold text-[13px] tracking-wide truncate">PT. KEMIKA KARYA PRATAMA</h2>
            <p className="text-[10px] text-white/50 truncate">Sistem Absensi & HR</p>
          </div>
        </div>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-5 overflow-y-auto">
        {navigationGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-2 text-[10px] font-bold tracking-[0.15em] text-white/35 uppercase select-none">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  end={item.href === "/dashboard"}
                  className="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/60 hover:bg-white/8 hover:text-white transition-all duration-200 ease-out text-[13px] hover:translate-x-0.5"
                  activeClassName="!bg-primary !text-white font-semibold shadow-lg shadow-primary/20 hover:!bg-primary hover:!text-white hover:!translate-x-0"
                >
                  <item.icon className="h-[18px] w-[18px] flex-shrink-0 transition-transform duration-200 group-hover:scale-110" />
                  <span className="transition-all duration-200">{item.name}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer - copyright only */}
      <div className="p-3 border-t border-white/8">
        <p className="text-[9px] text-white/25 text-center tracking-wide">© 2026 PT. Kemika Karya Pratama</p>
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
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-[hsl(161,80%,14%)] flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-2">
          <img src={logo} alt="Kemika" className="h-8 w-8 object-contain rounded bg-white/10 p-0.5" />
          <span className="text-white font-semibold text-sm">KEMIKA</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Mobile user dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-8 w-8 rounded-full bg-white/15 flex items-center justify-center text-white text-xs font-semibold">
                {profile?.full_name?.charAt(0) || "U"}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => navigate("/dashboard/employee-profile")}>
                <UserCircle className="h-4 w-4 mr-2" />
                My Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                <LogOut className="h-4 w-4 mr-2" />
                Keluar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
        {/* Top Bar */}
        <div className="hidden lg:flex items-center justify-between h-14 px-6 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-foreground">PT. KEMIKA KARYA PRATAMA</h2>
            <span className="text-xs text-muted-foreground">Enterprise Attendance & HR System</span>
          </div>
          {profile && (
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-muted-foreground cursor-pointer hover:text-foreground transition-colors" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2.5 hover:opacity-80 transition-opacity outline-none">
                    <div className="text-right">
                      <p className="text-sm font-medium leading-tight">{profile.full_name}</p>
                      <p className="text-[11px] text-muted-foreground">{profile.jabatan}</p>
                    </div>
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                      {profile.full_name?.charAt(0) || "U"}
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => navigate("/dashboard/employee-profile")}>
                    <UserCircle className="h-4 w-4 mr-2" />
                    My Profile
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                    <LogOut className="h-4 w-4 mr-2" />
                    Keluar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
