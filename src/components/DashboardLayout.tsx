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
  Menu
} from "lucide-react";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useNavigate } from "react-router-dom";

interface DashboardLayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Karyawan", href: "/dashboard/employees", icon: Users },
  { name: "Absensi", href: "/dashboard/attendance", icon: ClipboardCheck },
  { name: "Cuti", href: "/dashboard/leave", icon: Calendar },
  { name: "Lembur", href: "/dashboard/overtime", icon: Clock },
  { name: "Laporan", href: "/dashboard/reports", icon: FileText },
  { name: "Notifikasi", href: "/dashboard/notifications", icon: Bell },
  { name: "Pengaturan", href: "/dashboard/settings", icon: Settings },
];

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    navigate("/");
  };

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={`flex flex-col h-full ${mobile ? "" : "border-r border-border"}`}>
      <div className="p-6 border-b border-border">
        <img src={logo} alt="Kemika" className="h-12 object-contain" />
      </div>
      
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-foreground/70 hover:bg-accent hover:text-accent-foreground transition-colors"
            activeClassName="bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
          >
            <item.icon className="h-5 w-5" />
            <span className="font-medium">{item.name}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-border">
        <Button
          variant="outline"
          className="w-full justify-start gap-3"
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5" />
          <span>Keluar</span>
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 bg-card">
        <Sidebar />
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-card border-b border-border flex items-center justify-between px-4 z-50">
        <img src={logo} alt="Kemika" className="h-8 object-contain" />
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <Sidebar mobile />
          </SheetContent>
        </Sheet>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pt-16 lg:pt-0">
        <div className="container mx-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
