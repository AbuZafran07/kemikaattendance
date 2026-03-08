import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TABLES = [
  "profiles",
  "attendance",
  "leave_requests",
  "overtime_requests",
  "business_travel_requests",
  "payroll_periods",
  "payroll",
  "payroll_overrides",
  "employee_loans",
  "loan_installments",
];

const MAX_BACKUPS = 4;
const FIREBASE_SERVER_KEY = Deno.env.get("FIREBASE_SERVER_KEY");

async function notifyAdmins(
  supabase: ReturnType<typeof createClient>,
  success: boolean,
  details: string
) {
  try {
    // Get all admin users with FCM tokens
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (!adminRoles || adminRoles.length === 0) return;

    const adminIds = adminRoles.map((r: { user_id: string }) => r.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, fcm_token, full_name")
      .in("id", adminIds)
      .not("fcm_token", "is", null);

    if (!profiles || profiles.length === 0 || !FIREBASE_SERVER_KEY) {
      console.log("No admin FCM tokens found or Firebase not configured, skipping push notification");
      return;
    }

    const title = success
      ? "✅ Auto Backup Berhasil"
      : "❌ Auto Backup Gagal";
    const body = success
      ? `Backup terjadwal berhasil disimpan. ${details}`
      : `Backup terjadwal gagal. ${details}`;

    for (const profile of profiles) {
      if (!profile.fcm_token) continue;
      try {
        await fetch("https://fcm.googleapis.com/fcm/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `key=${FIREBASE_SERVER_KEY}`,
          },
          body: JSON.stringify({
            to: profile.fcm_token,
            notification: { title, body, icon: "/logo.png" },
            data: { type: "backup_status", success: String(success) },
          }),
        });
        console.log(`Push notification sent to admin ${profile.id}`);
      } catch (e) {
        console.error(`Failed to send push to ${profile.id}:`, e);
      }
    }
  } catch (e) {
    console.error("Failed to notify admins:", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Fetch all table data
    const backupData: Record<string, unknown[]> = {};
    let totalRecords = 0;
    for (const table of TABLES) {
      const { data, error } = await supabase.from(table).select("*");
      if (error) {
        console.error(`Error fetching ${table}:`, error.message);
        backupData[table] = [];
      } else {
        backupData[table] = data || [];
        totalRecords += (data || []).length;
      }
    }

    const backup = {
      version: "1.0",
      app: "Kemika Attendance",
      created_at: new Date().toISOString(),
      type: "scheduled",
      tables: TABLES,
      data: backupData,
    };

    const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
    const fileName = `scheduled-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

    const { error: uploadError } = await supabase.storage
      .from("backups")
      .upload(fileName, blob, { contentType: "application/json", upsert: false });

    if (uploadError) throw uploadError;

    // Cleanup old backups
    const { data: files } = await supabase.storage
      .from("backups")
      .list("", { sortBy: { column: "created_at", order: "desc" } });

    if (files) {
      const scheduledFiles = files.filter((f) => f.name.startsWith("scheduled-backup-"));
      if (scheduledFiles.length > MAX_BACKUPS) {
        const toDelete = scheduledFiles.slice(MAX_BACKUPS).map((f) => f.name);
        await supabase.storage.from("backups").remove(toDelete);
        console.log(`Cleaned up ${toDelete.length} old scheduled backups`);
      }
    }

    console.log(`Scheduled backup completed: ${fileName}`);

    // Notify admins of success
    await notifyAdmins(
      supabase,
      true,
      `${totalRecords} records dari ${TABLES.length} tabel.`
    );

    return new Response(JSON.stringify({ success: true, fileName }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    console.error("Scheduled backup failed:", err);

    // Notify admins of failure
    await notifyAdmins(supabase, false, err.message || "Unknown error");

    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
