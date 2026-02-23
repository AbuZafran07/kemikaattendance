import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Calendar, Clock, Plane, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PendingItem {
  id: string;
  type: "leave" | "overtime" | "travel";
  title: string;
  subtitle: string;
  date: string;
  userName: string;
}

const typeConfig = {
  leave: { icon: Calendar, label: "Cuti", color: "bg-blue-500/10 text-blue-600", route: "/dashboard/leave" },
  overtime: { icon: Clock, label: "Lembur", color: "bg-orange-500/10 text-orange-600", route: "/dashboard/overtime" },
  travel: { icon: Plane, label: "Dinas", color: "bg-purple-500/10 text-purple-600", route: "/dashboard/business-travel" },
};

const leaveTypeLabels: Record<string, string> = {
  cuti_tahunan: "Cuti Tahunan",
  izin: "Izin",
  sakit: "Sakit",
  lupa_absen: "Lupa Absen",
};

interface NotificationDropdownProps {
  pendingCount: number;
}

export const NotificationDropdown = ({ pendingCount }: NotificationDropdownProps) => {
  const navigate = useNavigate();
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const [leaveRes, overtimeRes, travelRes] = await Promise.all([
        supabase
          .from("leave_requests")
          .select("id, leave_type, start_date, end_date, created_at, user_id")
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("overtime_requests")
          .select("id, overtime_date, hours, created_at, user_id")
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("business_travel_requests")
          .select("id, destination, start_date, end_date, created_at, user_id")
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      const allData = [
        ...(leaveRes.data || []).map((r: any) => ({ ...r, _type: "leave" as const })),
        ...(overtimeRes.data || []).map((r: any) => ({ ...r, _type: "overtime" as const })),
        ...(travelRes.data || []).map((r: any) => ({ ...r, _type: "travel" as const })),
      ];

      // Fetch profiles for all user IDs
      const userIds = [...new Set(allData.map((d) => d.user_id))];
      const profilesMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);
        (profiles || []).forEach((p) => profilesMap.set(p.id, p.full_name));
      }

      const mapped: PendingItem[] = [];

      (leaveRes.data || []).forEach((r: any) => {
        mapped.push({
          id: r.id,
          type: "leave",
          title: leaveTypeLabels[r.leave_type] || r.leave_type,
          subtitle: `${format(new Date(r.start_date), "d MMM", { locale: localeId })} - ${format(new Date(r.end_date), "d MMM yyyy", { locale: localeId })}`,
          date: r.created_at,
          userName: profilesMap.get(r.user_id) || "Unknown",
        });
      });

      (overtimeRes.data || []).forEach((r: any) => {
        mapped.push({
          id: r.id,
          type: "overtime",
          title: `Lembur ${r.hours} jam`,
          subtitle: format(new Date(r.overtime_date), "d MMM yyyy", { locale: localeId }),
          date: r.created_at,
          userName: profilesMap.get(r.user_id) || "Unknown",
        });
      });

      (travelRes.data || []).forEach((r: any) => {
        mapped.push({
          id: r.id,
          type: "travel",
          title: r.destination,
          subtitle: `${format(new Date(r.start_date), "d MMM", { locale: localeId })} - ${format(new Date(r.end_date), "d MMM yyyy", { locale: localeId })}`,
          date: r.created_at,
          userName: profilesMap.get(r.user_id) || "Unknown",
        });
      });

      // Sort by date desc and take top 10
      mapped.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setItems(mapped.slice(0, 10));
    } catch (e) {
      console.error("Error fetching notification items:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) fetchItems();
  }, [open]);

  const handleItemClick = (item: PendingItem) => {
    setOpen(false);
    navigate(typeConfig[item.type].route);
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Baru saja";
    if (mins < 60) return `${mins} menit lalu`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} jam lalu`;
    const days = Math.floor(hours / 24);
    return `${days} hari lalu`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative cursor-pointer outline-none">
          <Bell className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
          {pendingCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {pendingCount > 99 ? "99+" : pendingCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Notifikasi</h3>
            {pendingCount > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5">
                {pendingCount} pending
              </Badge>
            )}
          </div>
        </div>

        {/* Items */}
        <ScrollArea className="max-h-[360px]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">Tidak ada request pending</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {items.map((item) => {
                const config = typeConfig[item.type];
                const Icon = config.icon;
                return (
                  <button
                    key={`${item.type}-${item.id}`}
                    onClick={() => handleItemClick(item)}
                    className="w-full flex items-start gap-3 px-4 py-3 hover:bg-accent/50 transition-colors text-left"
                  >
                    <div className={`mt-0.5 h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${config.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{item.userName}</p>
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 flex-shrink-0">
                          {config.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-foreground/80 truncate">{item.title}</p>
                      <p className="text-[11px] text-muted-foreground">{item.subtitle}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5 flex-shrink-0">
                      {timeAgo(item.date)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="border-t border-border px-4 py-2.5">
          <button
            onClick={() => { setOpen(false); navigate("/dashboard/notifications"); }}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Lihat Semua Notifikasi
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
