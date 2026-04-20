import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, CalendarRange, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import logger from "@/lib/logger";

interface DelegatedTask {
  id: string;
  start_date: string;
  end_date: string;
  delegation_notes: string | null;
  leave_type: string;
  requester_name: string;
  requester_jabatan: string;
}

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const isActive = (start: string, end: string) => {
  const today = new Date().toISOString().split("T")[0];
  return today >= start && today <= end;
};

const isUpcoming = (start: string) => {
  const today = new Date().toISOString().split("T")[0];
  return start > today;
};

const MyDelegatedTasks = () => {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<DelegatedTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    fetchDelegatedTasks();

    const channel = supabase
      .channel("realtime:my-delegated-tasks")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leave_requests" },
        () => fetchDelegatedTasks()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const fetchDelegatedTasks = async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];

      // Fetch approved leave requests where current user is the delegate
      // and the leave period hasn't ended yet
      const { data: leaveData, error: leaveError } = await supabase
        .from("leave_requests")
        .select("id, start_date, end_date, delegation_notes, leave_type, user_id")
        .eq("delegated_to", profile.id)
        .eq("status", "approved")
        .gte("end_date", today)
        .order("start_date", { ascending: true });

      if (leaveError) throw leaveError;
      if (!leaveData || leaveData.length === 0) {
        setTasks([]);
        return;
      }

      // Fetch requester profiles separately (client-side join)
      const requesterIds = [...new Set(leaveData.map((l) => l.user_id))];
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, jabatan")
        .in("id", requesterIds);

      if (profilesError) throw profilesError;

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);
      const enriched: DelegatedTask[] = leaveData.map((l) => {
        const p = profileMap.get(l.user_id);
        return {
          id: l.id,
          start_date: l.start_date,
          end_date: l.end_date,
          delegation_notes: l.delegation_notes,
          leave_type: l.leave_type,
          requester_name: p?.full_name || "Rekan Kerja",
          requester_jabatan: p?.jabatan || "-",
        };
      });

      setTasks(enriched);
    } catch (err) {
      logger.error("Failed to fetch delegated tasks:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return null;
  if (tasks.length === 0) return null;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" />
          Tugas Delegasi Saya
          <Badge variant="secondary" className="ml-auto">
            {tasks.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {tasks.map((task) => {
          const active = isActive(task.start_date, task.end_date);
          const upcoming = isUpcoming(task.start_date);
          return (
            <div
              key={task.id}
              className="p-3 rounded-lg border border-border bg-accent/30 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <User className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {task.requester_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {task.requester_jabatan}
                    </p>
                  </div>
                </div>
                {active && (
                  <Badge className="bg-green-600 hover:bg-green-700 text-white text-xs shrink-0">
                    Aktif
                  </Badge>
                )}
                {upcoming && (
                  <Badge variant="outline" className="text-xs shrink-0">
                    Mendatang
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarRange className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {formatDate(task.start_date)} - {formatDate(task.end_date)}
                </span>
              </div>

              {task.delegation_notes && (
                <div className="text-xs text-foreground bg-background rounded p-2 border border-border break-words">
                  <span className="font-medium text-muted-foreground">Tugas: </span>
                  {task.delegation_notes}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default MyDelegatedTasks;
