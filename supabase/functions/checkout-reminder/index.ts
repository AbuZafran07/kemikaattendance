// Edge Function: checkout-reminder
// Mengirim notifikasi push ke karyawan yang sudah check-in tapi belum check-out
// Dijadwalkan via pg_cron setiap jam pada Senin-Jumat
// Hanya mengirim notifikasi jika jam saat ini (WIB) cocok dengan pengaturan admin

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FIREBASE_SERVER_KEY = Deno.env.get("FIREBASE_SERVER_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function sendFCM(token: string, title: string, body: string) {
  if (!FIREBASE_SERVER_KEY) return null;
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
        data: { type: "checkout_reminder", timestamp: new Date().toISOString() },
      }),
    });
    return await res.json();
  } catch (e) {
    console.error("FCM error:", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Cek apakah ini panggilan manual (force=true) untuk lewati cek jam
    let force = false;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        force = body?.force === true;
      } catch (_) { /* ignore */ }
    }

    // Ambil pengaturan notifikasi
    const { data: settingsRow } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "notification_settings")
      .maybeSingle();

    const settings = (settingsRow?.value as any) || {};
    const enabled = settings.notifyMissedCheckOut !== false; // default true
    const reminderTime: string = settings.missedCheckOutTime || "17:00"; // HH:mm

    if (!enabled && !force) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "Reminder check-out dinonaktifkan" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Hitung waktu WIB (UTC+7)
    const nowUtc = new Date();
    const wib = new Date(nowUtc.getTime() + 7 * 60 * 60 * 1000);
    const yyyy = wib.getUTCFullYear();
    const mm = String(wib.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(wib.getUTCDate()).padStart(2, "0");
    const todayStr = `${yyyy}-${mm}-${dd}`;
    const currentHourWib = wib.getUTCHours();

    // Validasi jam (kecuali force/manual)
    const [reminderHourStr] = reminderTime.split(":");
    const reminderHour = parseInt(reminderHourStr, 10);
    if (!force && currentHourWib !== reminderHour) {
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: `Jam saat ini ${currentHourWib}:00 WIB tidak cocok dengan pengaturan ${reminderTime} WIB`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Range hari ini dalam UTC (00:00 WIB → 23:59 WIB)
    const startUtc = new Date(`${todayStr}T00:00:00+07:00`).toISOString();
    const endUtc = new Date(`${todayStr}T23:59:59+07:00`).toISOString();

    // Ambil semua attendance hari ini yang BELUM checkout
    const { data: attendances, error: attErr } = await supabase
      .from("attendance")
      .select("id, user_id, check_in_time, check_out_time")
      .gte("check_in_time", startUtc)
      .lte("check_in_time", endUtc)
      .is("check_out_time", null);

    if (attErr) throw attErr;

    if (!attendances || attendances.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Tidak ada karyawan yang perlu diingatkan", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userIds = attendances.map((a) => a.user_id);

    // Ambil profile + FCM token, exclude BOD/Komisaris/Inactive
    const { data: profiles, error: profErr } = await supabase
      .from("profiles")
      .select("id, full_name, fcm_token, departemen, status")
      .in("id", userIds)
      .eq("status", "Active")
      .not("departemen", "in", "(BOD,Komisaris)")
      .not("fcm_token", "is", null);

    if (profErr) throw profErr;

    let sent = 0;
    const results: Array<{ user_id: string; name: string; sent: boolean }> = [];

    for (const profile of profiles || []) {
      if (!profile.fcm_token) continue;
      const result = await sendFCM(
        profile.fcm_token,
        "⏰ Pengingat Check-Out",
        `Halo ${profile.full_name}, Anda belum melakukan check-out hari ini. Jangan lupa absen pulang agar tunjangan kehadiran Anda tetap dihitung.`
      );
      const ok = result && (result.success === 1 || result.message_id);
      if (ok) sent++;
      results.push({ user_id: profile.id, name: profile.full_name, sent: !!ok });
    }

    return new Response(
      JSON.stringify({
        success: true,
        date: todayStr,
        reminder_time: reminderTime,
        current_hour_wib: currentHourWib,
        total_pending: attendances.length,
        notifications_sent: sent,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("checkout-reminder error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
