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

  const UserDropdown = ({ mobile = false }: { mobile?: boolean }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {mobile ? (
          <button className="h-8 w-8 rounded-full bg-white/15 flex items-center justify-center text-white text-xs font-semibold">
            {profile?.full_name?.charAt(0) || "U"}
          </button>
        ) : (
          <button className="flex items-center gap-3 hover:opacity-80 transition-opacity outline-none">
            <div className="relative">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm border-2 border-primary/20">
                {profile?.full_name?.charAt(0) || "U"}
              </div>
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-primary border-2 border-card" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold leading-tight">{profile?.full_name}</p>
              <span className="inline-block mt-0.5 text-[10px] font-semibold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                Admin
              </span>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => navigate("/employee/profile")}>
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
  );

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex flex-col h-full bg-[hsl(161,80%,14%)] text-white">
      {/* Navigation - no header */}
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

      {/* Footer */}
      <div className="p-3 border-t border-white/8">
        <p className="text-[9px] text-white/25 text-center tracking-wide">© 2026 PT. Kemika Karya Pratama</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Full-width Top Header (desktop) */}
      <div className="hidden lg:block flex-shrink-0">
        <div className="flex items-center justify-between h-16 px-6 bg-card border-b border-border">
          {/* Left: Logo + Company name */}
          <div className="flex items-center gap-3">
            <img src={logo} alt="Kemika" className="h-9 object-contain" />
            <div>
              <h2 className="text-sm font-bold text-foreground leading-tight">PT. KEMIKA KARYA PRATAMA</h2>
              <p className="text-[11px] text-muted-foreground">Attendance & HR Management System</p>
            </div>
          </div>

          {/* Right: Bell + User dropdown */}
          {profile && (
            <div className="flex items-center gap-4">
              <div className="relative cursor-pointer">
                <Bell className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
              </div>
              <UserDropdown />
            </div>
          )}
        </div>
      </div>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-[hsl(161,80%,14%)] flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-2">
          <img src={logo} alt="Kemika" className="h-8 w-8 object-contain rounded bg-white/10 p-0.5" />
          <span className="text-white font-semibold text-sm">KEMIKA</span>
        </div>
        <div className="flex items-center gap-2">
          <UserDropdown mobile />
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

      {/* Body: Sidebar + Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-[250px] flex-shrink-0">
          <Sidebar />
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;