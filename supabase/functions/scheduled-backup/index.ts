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
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

async function sendEmailNotification(
  adminEmails: string[],
  success: boolean,
  details: string
) {
  if (!RESEND_API_KEY || adminEmails.length === 0) {
    console.log("Resend not configured or no admin emails, skipping email notification");
    return;
  }

  const timestamp = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

  const subject = success
    ? "✅ Auto Backup Berhasil - Kemika Attendance"
    : "❌ Auto Backup Gagal - Kemika Attendance";

  const statusColor = success ? "#16a34a" : "#dc2626";
  const statusText = success ? "BERHASIL" : "GAGAL";
  const statusIcon = success ? "✅" : "❌";

  const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <!-- Header -->
        <tr>
          <td style="background-color:#1e293b;padding:24px 32px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">Kemika Attendance</h1>
            <p style="margin:4px 0 0;color:#94a3b8;font-size:13px;">Notifikasi Auto Backup</p>
          </td>
        </tr>
        <!-- Status Badge -->
        <tr>
          <td style="padding:32px 32px 16px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background-color:${statusColor}10;border-left:4px solid ${statusColor};padding:16px 20px;border-radius:0 6px 6px 0;">
                  <p style="margin:0;font-size:16px;font-weight:700;color:${statusColor};">
                    ${statusIcon} Backup ${statusText}
                  </p>
                  <p style="margin:6px 0 0;font-size:14px;color:#475569;">${details}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Details -->
        <tr>
          <td style="padding:0 32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;">
              <tr style="background-color:#f8fafc;">
                <td style="padding:10px 16px;font-size:13px;color:#64748b;border-bottom:1px solid #e2e8f0;">Waktu</td>
                <td style="padding:10px 16px;font-size:13px;color:#1e293b;border-bottom:1px solid #e2e8f0;font-weight:600;">${timestamp} WIB</td>
              </tr>
              <tr>
                <td style="padding:10px 16px;font-size:13px;color:#64748b;border-bottom:1px solid #e2e8f0;">Tipe</td>
                <td style="padding:10px 16px;font-size:13px;color:#1e293b;border-bottom:1px solid #e2e8f0;">Backup Terjadwal (Mingguan)</td>
              </tr>
              <tr style="background-color:#f8fafc;">
                <td style="padding:10px 16px;font-size:13px;color:#64748b;">Tabel</td>
                <td style="padding:10px 16px;font-size:13px;color:#1e293b;">${TABLES.length} tabel</td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background-color:#f8fafc;padding:16px 32px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">
              Email ini dikirim otomatis oleh sistem Kemika Attendance.<br>
              Jangan balas email ini.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  for (const email of adminEmails) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Kemika Attendance <onboarding@resend.dev>",
          to: [email],
          subject,
          html: htmlBody,
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        console.error(`Failed to send email to ${email}: ${res.status} ${errBody}`);
      } else {
        console.log(`Email notification sent to ${email}`);
      }
    } catch (e) {
      console.error(`Error sending email to ${email}:`, e);
    }
  }
}

async function notifyAdminsPush(
  supabase: ReturnType<typeof createClient>,
  profiles: { id: string; fcm_token: string | null }[],
  success: boolean,
  details: string
) {
  if (!FIREBASE_SERVER_KEY) {
    console.log("Firebase not configured, skipping push notification");
    return;
  }

  const title = success ? "✅ Auto Backup Berhasil" : "❌ Auto Backup Gagal";
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
}

async function notifyAdmins(
  supabase: ReturnType<typeof createClient>,
  success: boolean,
  details: string
) {
  try {
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (!adminRoles || adminRoles.length === 0) return;

    const adminIds = adminRoles.map((r: { user_id: string }) => r.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, fcm_token, full_name, email")
      .in("id", adminIds);

    if (!profiles || profiles.length === 0) return;

    // Send email notifications
    const adminEmails = profiles
      .map((p: { email: string }) => p.email)
      .filter(Boolean);
    await sendEmailNotification(adminEmails, success, details);

    // Send push notifications
    await notifyAdminsPush(supabase, profiles, success, details);
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

    await notifyAdmins(
      supabase,
      true,
      `${totalRecords} records dari ${TABLES.length} tabel berhasil di-backup.`
    );

    return new Response(JSON.stringify({ success: true, fileName }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    console.error("Scheduled backup failed:", err);

    await notifyAdmins(supabase, false, err.message || "Unknown error");

    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
