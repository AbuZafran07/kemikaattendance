import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const RESTORE_ORDER = [
  "profiles",
  "payroll_periods",
  "employee_loans",
  "attendance",
  "leave_requests",
  "overtime_requests",
  "business_travel_requests",
  "payroll",
  "payroll_overrides",
  "loan_installments",
];

// Retensi khusus file snapshot pra-restore
const MAX_PRE_RESTORE = 5;

// deno-lint-ignore no-explicit-any
async function fetchAllRows(supabase: any, table: string): Promise<Record<string, unknown>[]> {
  const PAGE = 1000;
  let from = 0;
  let all: Record<string, unknown>[] = [];
  while (true) {
    const { data, error } = await supabase.from(table).select("*").range(from, from + PAGE - 1);
    if (error) throw new Error(`Gagal ambil ${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verifikasi JWT + role admin/hr
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    const userId = userData?.user?.id;
    if (userErr || !userId) return json({ error: "Unauthorized" }, 401);

    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const allowed = (roles ?? []).some((r: { role: string }) => r.role === "admin" || r.role === "hr");
    if (!allowed) return json({ error: "Forbidden" }, 403);

    // Bangun snapshot server-side (cepat, tidak tergantung koneksi user)
    const backupData: Record<string, unknown[]> = {};
    let totalRecords = 0;
    for (const table of RESTORE_ORDER) {
      const rows = await fetchAllRows(admin, table);
      backupData[table] = rows;
      totalRecords += rows.length;
    }

    const payload = {
      version: "1.0",
      app: "Kemika Attendance",
      created_at: new Date().toISOString(),
      type: "pre_restore",
      tables: RESTORE_ORDER,
      total_records: totalRecords,
      data: backupData,
    };

    const fileName = `pre-restore-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    const { error: uploadErr } = await admin.storage
      .from("backups")
      .upload(fileName, new Blob([JSON.stringify(payload)], { type: "application/json" }), {
        contentType: "application/json",
        upsert: false,
      });
    if (uploadErr) return json({ error: `Snapshot gagal diunggah: ${uploadErr.message}` }, 500);

    // Retensi otomatis: simpan hanya 5 snapshot pra-restore terbaru
    let deleted: string[] = [];
    const { data: files } = await admin.storage
      .from("backups")
      .list("", { limit: 1000, sortBy: { column: "created_at", order: "desc" } });
    const preRestore = (files ?? []).filter((f: { name: string }) =>
      f.name.startsWith("pre-restore-backup-")
    );
    if (preRestore.length > MAX_PRE_RESTORE) {
      deleted = preRestore.slice(MAX_PRE_RESTORE).map((f: { name: string }) => f.name);
      if (deleted.length > 0) await admin.storage.from("backups").remove(deleted);
    }

    // Catat ke audit log backup
    await admin.from("backup_audit_logs").insert({
      action_type: "PRE_RESTORE_SNAPSHOT",
      file_name: fileName,
      records: totalRecords,
      tables_affected: RESTORE_ORDER,
      performed_by: userId,
      notes: `Snapshot pengaman dibuat sebelum restore (${totalRecords} records)`,
      details: { deleted_old_snapshots: deleted },
    });

    return json({ success: true, file_name: fileName, total_records: totalRecords, pruned: deleted });
  } catch (e) {
    console.error("pre-restore-snapshot error:", e);
    return json({ error: "Gagal membuat snapshot pengaman" }, 500);
  }
});
