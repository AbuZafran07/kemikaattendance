import { Home, Calendar, Bell, User, LayoutGrid } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
  isCenter?: boolean;
}

const navItems: NavItem[] = [
  { label: "Beranda", icon: Home, path: "/employee" },
  { label: "Cuti", icon: Calendar, path: "/employee/leave-request" },
  { label: "Self Service", icon: LayoutGrid, path: "/employee/self-service", isCenter: true },
  { label: "Notifikasi", icon: Bell, path: "/employee/notifications" },
  { label: "Profil", icon: User, path: "/employee/profile" },
];

export const EmployeeBottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 pb-safe">
      <div className="flex items-end justify-around h-16 max-w-lg mx-auto relative">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || 
            (item.path === "/employee" && location.pathname === "/employee") ||
            (item.path === "/employee/self-service" && location.pathname.includes("/employee/self-service"));
          
          if (item.isCenter) {
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="flex flex-col items-center justify-center -mt-6"
              >
                <div className={cn(
                  "w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-colors",
                  isActive ? "bg-primary text-primary-foreground" : "bg-primary/80 text-primary-foreground"
                )}>
                  <item.icon className="h-6 w-6" />
                </div>
                <span className={cn(
                  "text-xs mt-1 font-medium",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}>
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center justify-center py-2 px-3"
            >
              <item.icon className={cn(
                "h-5 w-5 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )} />
              <span className={cn(
                "text-xs mt-1",
                isActive ? "text-primary font-medium" : "text-muted-foreground"
              )}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
