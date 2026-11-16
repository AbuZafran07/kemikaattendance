import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useLateReasonWindow() {
  const [window, setWindow] = useState<{ hours: number; serverTime: number; receivedAt: number } | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const refresh = async () => {
      const { data, error } = await supabase.rpc("get_late_reason_window");
      if (error || !data || typeof data !== "object" || Array.isArray(data)) return;
      const hours = Number(data.deadline_hours);
      const serverTime = Date.parse(String(data.server_now));
      if (hours > 0 && Number.isFinite(serverTime)) setWindow({ hours, serverTime, receivedAt: performance.now() });
    };
    void refresh();
    const timer = globalThis.setInterval(() => { setTick(t => t + 1); }, 1000);
    const sync = globalThis.setInterval(() => { void refresh(); }, 60_000);
    return () => { clearInterval(timer); clearInterval(sync); };
  }, []);
  void tick;
  return { deadlineHours: window?.hours, serverNow: window ? window.serverTime + performance.now() - window.receivedAt : NaN };
}