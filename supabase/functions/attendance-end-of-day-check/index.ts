// Edge Function: attendance-end-of-day-check
// Fase 3 — Violation Engine cron.
// 1. Untuk setiap karyawan aktif (non-admin) tanpa catatan attendance hari ini:
//    - skip kalau ada leave/business-travel request yang masih pending
//    - skip kalau ada yang approved (izin/cuti/dinas sah)
//    - kalau ada yang rejected -> violation 'absent_without_permission'
//    - kalau tidak ada pengajuan sama sekali -> violation 'no_attendance_record'
// 2. Submitted late reasons remain pending until HR decides, regardless of age.
//
// Dijadwalkan mirip checkout-reminder (lihat komentar di file itu): lewat pg_cron /
// Supabase Dashboard Cron Jobs, dipanggil setelah jam kerja selesai setiap hari kerja.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing configuration");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    // Runs on weekends/holidays too, before the daily absence scan's time gate.
    // The database serializes this with reason submission and checks all history.
    const { data: missingLateReasons, error: missingReasonError } = await supabase.rpc("scan_missing_late_reasons");
    if (missingReasonError) throw missingReasonError;

    let force = false;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        force = body?.force === true;
      } catch (_) { /* ignore */ }
    }

    // Waktu WIB (UTC+7), sama seperti checkout-reminder
    const nowUtc = new Date();
    const wib = new Date(nowUtc.getTime() + 7 * 60 * 60 * 1000);
    const yyyy = wib.getUTCFullYear();
    const mm = String(wib.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(wib.getUTCDate()).padStart(2, "0");
    const todayStr = `${yyyy}-${mm}-${dd}`;
    const currentHourWib = wib.getUTCHours();

    // Jalan hanya setelah jam kerja selesai (dari get_effective_work_hours), kecuali force
    const { data: workHours } = await supabase.rpc("get_effective_work_hours");
    const checkOutEnd: string = (workHours as any)?.check_out_end || "17:00";
    const [endHourStr] = checkOutEnd.split(":");
    const endHour = parseInt(endHourStr, 10);

    if (!force && currentHourWib < endHour) {
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          missing_late_reason_violations: missingLateReasons,
          reason: `Jam saat ini ${currentHourWib}:00 WIB masih sebelum jam kerja selesai (${checkOutEnd} WIB)`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Lewati akhir pekan & hari libur nasional/cuti bersama
    const dayOfWeek = wib.getUTCDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    let isHoliday = false;
    if (!isWeekend) {
      const { data: policyRow } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "overtime_policy")
        .maybeSingle();
      const holidays: Array<{ date: string }> = ((policyRow?.value as any)?.holidays) || [];
      isHoliday = holidays.some((h) => h.date === todayStr);
    }
    const skipAbsenceScan = isWeekend || isHoliday;

    // ============ 1. No attendance / absent without permission ============
    const { data: adminRoles } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
    const adminIds = new Set((adminRoles || []).map((r) => r.user_id));

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("status", "Active")
      .or("departemen.is.null,departemen.not.in.(BOD,Komisaris)")
      .is("resign_date", null);
    if (profilesError) throw profilesError;

    const activeEmployees = (profiles || []).filter((p) => !adminIds.has(p.id));

    const startUtc = new Date(`${todayStr}T00:00:00+07:00`).toISOString();
    const endUtc = new Date(`${todayStr}T23:59:59+07:00`).toISOString();

    const { data: todaysAttendance } = await supabase
      .from("attendance")
      .select("user_id")
      .gte("check_in_time", startUtc)
      .lte("check_in_time", endUtc);
    const attendedIds = new Set((todaysAttendance || []).map((a) => a.user_id));

    const missingEmployees = activeEmployees.filter((p) => !attendedIds.has(p.id));

    const absenceResults: Array<{ user_id: string; violation_type: string | null }> = [];

    if (missingEmployees.length > 0 && !skipAbsenceScan) {
      const missingIds = missingEmployees.map((p) => p.id);

      const { data: leaveRequests } = await supabase
        .from("leave_requests")
        .select("user_id, status, start_date, end_date")
        .in("user_id", missingIds)
        .lte("start_date", todayStr)
        .gte("end_date", todayStr);

      const { data: travelRequests } = await supabase
        .from("business_travel_requests")
        .select("user_id, status, start_date, end_date")
        .in("user_id", missingIds)
        .lte("start_date", todayStr)
        .gte("end_date", todayStr);

      const requestsByUser = new Map<string, Array<{ status: string }>>();
      for (const r of [...(leaveRequests || []), ...(travelRequests || [])]) {
        const list = requestsByUser.get(r.user_id) || [];
        list.push({ status: r.status });
        requestsByUser.set(r.user_id, list);
      }

      for (const employee of missingEmployees) {
        const requests = requestsByUser.get(employee.id) || [];
        const hasPending = requests.some((r) => r.status === "pending");
        const hasApproved = requests.some((r) => r.status === "approved");
        const hasRejected = requests.some((r) => r.status === "rejected");

        if (hasPending || hasApproved) {
          absenceResults.push({ user_id: employee.id, violation_type: null });
          continue;
        }

        const violationType = hasRejected ? "absent_without_permission" : "no_attendance_record";
        const description = hasRejected
          ? "Tidak hadir tanpa keterangan yang disetujui (pengajuan izin/cuti/dinas ditolak)."
          : "Tidak ada catatan kehadiran pada tanggal ini dan tidak ada pengajuan izin/cuti/dinas.";

        const { error: violationError } = await supabase.rpc("create_attendance_violation", {
          p_user_id: employee.id,
          p_attendance_id: null,
          p_violation_date: todayStr,
          p_violation_type: violationType,
          p_description: description,
          p_source: "system",
        });
        if (violationError) {
          console.error(`Failed to create violation for ${employee.id}:`, violationError);
        }
        absenceResults.push({ user_id: employee.id, violation_type: violationType });
      }
    }

    // No expiration scan: an already-submitted reason is not a missing reason.
    // Rejection/approval RPCs own the decision and associated violation count.

    return new Response(
      JSON.stringify({
        success: true,
        date: todayStr,
        current_hour_wib: currentHourWib,
        absence_scan_skipped: skipAbsenceScan,
        skip_reason: isWeekend ? "weekend" : isHoliday ? "holiday" : null,
        employees_checked: activeEmployees.length,
        missing_attendance: missingEmployees.length,
        violations_created: absenceResults.filter((r) => r.violation_type).length,
        late_reasons_expired: 0,
        missing_late_reason_violations: missingLateReasons,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("attendance-end-of-day-check error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
