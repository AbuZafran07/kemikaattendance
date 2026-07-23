// Edge Function: contract-reminder-scheduler
// Cek karyawan yang kontraknya akan habis H-30 / H-7 / hari ini,
// kirim notifikasi FCM & email ke admin+HR, dan catat ke contract_reminders_log.
// Dijadwalkan harian via pg_cron.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIREBASE_SERVER_KEY = Deno.env.get("FIREBASE_SERVER_KEY");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

async function sendFCM(token: string, title: string, body: string, data: Record<string, string>) {
  if (!FIREBASE_SERVER_KEY || !token) return false;
  try {
    const res = await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `key=${FIREBASE_SERVER_KEY}`,
      },
      body: JSON.stringify({
        to: token,
        notification: { title, body, icon: "/logo.png" },
        data,
      }),
    });
    return res.ok;
  } catch (e) {
    console.error("FCM error:", e);
    return false;
  }
}

async function sendEmail(to: string[], subject: string, html: string) {
  if (!RESEND_API_KEY || to.length === 0) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Kemika HRIS <onboarding@resend.dev>",
        to,
        subject,
        html,
      }),
    });
    return res.ok;
  } catch (e) {
    console.error("Email error:", e);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const buckets: Array<{ type: "H30" | "H7" | "EXPIRED"; days: number }> = [
    { type: "H30", days: 30 },
    { type: "H7", days: 7 },
    { type: "EXPIRED", days: 0 },
  ];

  // Ambil semua admin + HR (penerima notifikasi)
  const { data: adminRoles } = await supabase
    .from("user_roles")
    .select("user_id, role")
    .in("role", ["admin", "hr"]);
  const adminIds = [...new Set((adminRoles || []).map((r: any) => r.user_id))];

  const { data: adminProfiles } = await supabase
    .from("profiles")
    .select("id, email, fcm_token, full_name")
    .in("id", adminIds.length ? adminIds : ["00000000-0000-0000-0000-000000000000"]);

  const adminEmails = (adminProfiles || []).map((p: any) => p.email).filter(Boolean);
  const adminTokens = (adminProfiles || []).map((p: any) => p.fcm_token).filter(Boolean);

  const summary: any[] = [];

  for (const bucket of buckets) {
    const target = new Date(today);
    target.setDate(target.getDate() + bucket.days);
    const targetStr = target.toISOString().slice(0, 10);

    const { data: employees } = await supabase
      .from("profiles")
      .select("id, full_name, nik, jabatan, departemen, contract_number, contract_type, contract_end_date, status")
      .eq("contract_end_date", targetStr)
      .eq("status", "Active");

    for (const emp of employees || []) {
      // cek duplikat
      const { data: existing } = await supabase
        .from("contract_reminders_log")
        .select("id")
        .eq("employee_id", emp.id)
        .eq("contract_end_date", emp.contract_end_date)
        .eq("reminder_type", bucket.type)
        .maybeSingle();

      if (existing) continue;

      const title =
        bucket.type === "EXPIRED"
          ? `⚠️ Kontrak Berakhir Hari Ini: ${emp.full_name}`
          : bucket.type === "H7"
          ? `⏰ Kontrak Berakhir 7 Hari Lagi: ${emp.full_name}`
          : `📅 Kontrak Berakhir 30 Hari Lagi: ${emp.full_name}`;

      const body = `${emp.jabatan || "-"} · ${emp.departemen || "-"} · Kontrak berakhir ${emp.contract_end_date}`;

      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;">
          <h2 style="color:#0a4d3c;">${title}</h2>
          <p>Karyawan berikut memerlukan tindakan perpanjangan/pengakhiran kontrak:</p>
          <table style="border-collapse:collapse;width:100%;">
            <tr><td style="padding:6px;border:1px solid #ddd;"><b>Nama</b></td><td style="padding:6px;border:1px solid #ddd;">${emp.full_name}</td></tr>
            <tr><td style="padding:6px;border:1px solid #ddd;"><b>NIK</b></td><td style="padding:6px;border:1px solid #ddd;">${emp.nik || "-"}</td></tr>
            <tr><td style="padding:6px;border:1px solid #ddd;"><b>Jabatan</b></td><td style="padding:6px;border:1px solid #ddd;">${emp.jabatan || "-"}</td></tr>
            <tr><td style="padding:6px;border:1px solid #ddd;"><b>Departemen</b></td><td style="padding:6px;border:1px solid #ddd;">${emp.departemen || "-"}</td></tr>
            <tr><td style="padding:6px;border:1px solid #ddd;"><b>No. Kontrak</b></td><td style="padding:6px;border:1px solid #ddd;">${emp.contract_number || "-"}</td></tr>
            <tr><td style="padding:6px;border:1px solid #ddd;"><b>Tipe</b></td><td style="padding:6px;border:1px solid #ddd;">${emp.contract_type || "-"}</td></tr>
            <tr><td style="padding:6px;border:1px solid #ddd;"><b>Tgl Berakhir</b></td><td style="padding:6px;border:1px solid #ddd;">${emp.contract_end_date}</td></tr>
          </table>
          <p style="margin-top:16px;color:#555;">Notifikasi otomatis dari Kemika HRIS.</p>
        </div>`;

      const channels: any = { fcm: false, email: false };
      // FCM ke semua admin/HR
      for (const t of adminTokens) {
        const ok = await sendFCM(t, title, body, {
          type: "contract_reminder",
          reminder_type: bucket.type,
          employee_id: emp.id,
        });
        if (ok) channels.fcm = true;
      }
      // Email ke semua admin/HR
      if (adminEmails.length) {
        const ok = await sendEmail(adminEmails, title, html);
        if (ok) channels.email = true;
      }

      await supabase.from("contract_reminders_log").insert({
        employee_id: emp.id,
        contract_end_date: emp.contract_end_date,
        reminder_type: bucket.type,
        channels,
        recipients: { admin_ids: adminIds, emails: adminEmails },
        status: channels.fcm || channels.email ? "sent" : "failed",
      });

      summary.push({ employee: emp.full_name, type: bucket.type, channels });
    }
  }

  return new Response(
    JSON.stringify({ success: true, processed: summary.length, summary }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
