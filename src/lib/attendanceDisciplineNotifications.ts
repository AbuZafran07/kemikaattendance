import { supabase } from "@/integrations/supabase/client";
import { sendPushNotification } from "@/lib/notifications";
import logger from "@/lib/logger";

/**
 * attendance_notifications rows are inserted server-side from SECURITY DEFINER
 * RPCs (late reason rejection, unlock letter review, threshold checks, ...),
 * so there's no single client call site that knows exactly which rows a given
 * RPC created. Instead of a DB trigger (this project has no pg_net precedent),
 * call this right after an RPC that may insert attendance_notifications,
 * passing a timestamp captured just before the call — it looks up whatever
 * landed since then and best-effort pushes FCM for each one.
 */
export const pushRecentAttendanceNotifications = async (sinceIso: string): Promise<void> => {
  try {
    const { data: rows, error } = await supabase
      .from("attendance_notifications")
      .select("user_id, title, message")
      .gte("created_at", sinceIso);

    if (error || !rows || rows.length === 0) return;

    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, fcm_token")
      .in("id", userIds)
      .not("fcm_token", "is", null);

    const tokenMap = new Map((profiles || []).map((p) => [p.id, p.fcm_token as string]));

    for (const row of rows) {
      const token = tokenMap.get(row.user_id);
      if (token) {
        await sendPushNotification({ fcmToken: token, title: row.title, body: row.message });
      }
    }
  } catch (error) {
    logger.error("Failed to push recent attendance notifications:", error);
  }
};

export const nowMinusBuffer = (bufferMs = 5000): string => new Date(Date.now() - bufferMs).toISOString();
