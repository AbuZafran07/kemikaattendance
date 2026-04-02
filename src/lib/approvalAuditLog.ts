import { supabase } from "@/integrations/supabase/client";
import logger from "@/lib/logger";

interface AuditLogEntry {
  request_type: "leave" | "overtime" | "business_travel";
  request_id: string;
  action_type: "approved" | "rejected" | "created_by_admin";
  performed_by: string;
  target_user_id: string;
  details?: Record<string, unknown>;
  notes?: string | null;
}

export const logApprovalAction = async (entry: AuditLogEntry) => {
  try {
    const { error } = await supabase.from("approval_audit_logs").insert({
      request_type: entry.request_type,
      request_id: entry.request_id,
      action_type: entry.action_type,
      performed_by: entry.performed_by,
      target_user_id: entry.target_user_id,
      details: entry.details || {},
      notes: entry.notes || null,
    });

    if (error) {
      logger.error("Failed to log approval action:", error);
    }
  } catch (err) {
    logger.error("Error logging approval action:", err);
  }
};
