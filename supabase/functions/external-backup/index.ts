import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { authenticateCronRequest } from "../_shared/cron-auth.ts";
import { getAllowedOrigin } from "../_shared/cors.ts";
import { backupIsStale, collectBackup, expiredBackupNames, PREFIX } from "./backup.ts";
import { countMismatches, exactCounts, listBackupTables, tablePageReader } from "../_shared/backup-tables.ts";
import { alertAdmins } from "../_shared/backup-alert.ts";

const DESTINATION = "https://pixigfhijudkuaozzoea.supabase.co";
const STATUS_FILE = "external-backup-status.json";

Deno.serve(async request => {
  const headers = { ...corsHeaders, "Access-Control-Allow-Origin": getAllowedOrigin(request.headers.get("origin")), "Content-Type": "application/json" };
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  const cronFailure = authenticateCronRequest(request);
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !key || !anon) return reply({ error: "Server configuration error" }, 500);
  const source = createClient(url, key, { auth: { persistSession: false } });
  if (cronFailure) {
    const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1];
    if (!token) return reply({ error: "Unauthorized" }, 401);
    const { data, error } = await createClient(url, anon).auth.getUser(token);
    if (error || !data.user) return reply({ error: "Unauthorized" }, 401);
    const roles = await source.from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "admin");
    if (roles.error || !roles.data?.length) return reply({ error: "Forbidden" }, 403);
  }
  let action: "status" | "backup" | "health";
  try {
    const body = await request.json();
    if (!body || !["status", "backup", "health"].includes(body.action) || Object.keys(body).some(k => k !== "action")) return reply({ error: "Invalid request" }, 400);
    action = body.action;
  } catch { return reply({ error: "Invalid request" }, 400); }
  const externalKey = Deno.env.get("EXTERNAL_BACKUP_SECRET_KEY");
  const previous = await source.storage.from("backups").download(STATUS_FILE);
  let last: Record<string, unknown> = {};
  if (previous.data) { try { last = JSON.parse(await previous.data.text()); } catch { /* no status yet */ } }
  const gdrive = await source.from("system_settings").select("value").eq("key", "gdrive_backup_config").maybeSingle();
  const gdriveLast = (gdrive.data?.value as { last_backup_at?: string } | null)?.last_backup_at ?? null;
  if (action === "status") {
    let tableCount: number | null = null;
    try { tableCount = (await listBackupTables(source)).tables.length; } catch { /* unavailable */ }
    return reply({ configured: !!externalKey, ...last, table_count: tableCount, gdrive_last_backup_at: gdriveLast });
  }
  if (action === "health") {
    const stale = backupIsStale([last.last_backup_at as string | undefined, gdriveLast]);
    if (stale) await alertAdmins(source, "Peringatan: backup belum berhasil 36 jam", "Tidak ada backup Google Drive maupun Supabase eksternal yang berhasil dalam 36 jam terakhir. Periksa halaman Backup & Restore.");
    return reply({ stale });
  }
  if (!externalKey) return reply({ error: "Kunci backup eksternal belum tersedia" }, 503);
  const target = createClient(DESTINATION, externalKey, { auth: { persistSession: false } });
  let uploaded = false;
  try {
    const bucket = await target.storage.getBucket("backups");
    if (bucket.error || !bucket.data || bucket.data.public) return reply({ error: "Bucket backups tujuan harus tersedia dan bersifat privat" }, 409);
    const { tables, skipped } = await listBackupTables(source);
    const names = tables.map(t => t.table_name);
    const backup = await collectBackup(names, skipped, tablePageReader(source, tables));
    const json = JSON.stringify(backup);
    const file = `${PREFIX}/backup-${backup.created_at.replace(/[:.]/g, "-")}.json`;
    const upload = await target.storage.from("backups").upload(file, new Blob([json], { type: "application/json" }), { upsert: false });
    if (upload.error) throw new Error("Upload failed");
    uploaded = true;
    const readback = await target.storage.from("backups").download(file);
    if (readback.error || !readback.data) throw new Error("Unduh ulang file gagal");
    const readText = await readback.data.text();
    if (readText !== json) throw new Error("Isi file hasil unduh ulang berbeda");
    const fileCounts = JSON.parse(readText).manifest.row_counts as Record<string, number>;
    const mismatches = countMismatches(fileCounts, await exactCounts(source, names));
    if (mismatches.length) throw new Error(`Jumlah baris berbeda: ${mismatches.slice(0, 5).join("; ")}`);
    const files: { name: string }[] = [];
    for (let offset = 0; ; offset += 100) {
      const page = await target.storage.from("backups").list(PREFIX, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
      if (page.error) throw new Error("Retention listing failed");
      files.push(...(page.data ?? []));
      if (!page.data || page.data.length < 100) break;
    }
    const expired = expiredBackupNames(files);
    if (expired.length) {
      const removal = await target.storage.from("backups").remove(expired);
      if (removal.error) throw new Error("Retention failed");
    }
    const status = { last_backup_at: backup.created_at, last_backup_file: file, records: backup.manifest.total_records, table_count: backup.manifest.table_count, row_counts: backup.manifest.row_counts, skipped_tables: backup.manifest.skipped_tables, last_error: null, last_attempt_at: new Date().toISOString(), last_attempt_success: true };
    const saved = await source.storage.from("backups").upload(STATUS_FILE, new Blob([JSON.stringify(status)], { type: "application/json" }), { upsert: true });
    if (saved.error) throw new Error("Status save failed");
    return reply({ success: true, ...status });
  } catch (e) {
    const reason = e instanceof Error ? e.message : "Kesalahan tidak diketahui";
    const status = { ...last, last_attempt_at: new Date().toISOString(), last_attempt_success: false, last_error: reason };
    await alertAdmins(source, "Backup Supabase eksternal gagal", `Backup eksternal gagal: ${reason}`);
    await source.storage.from("backups").upload(STATUS_FILE, new Blob([JSON.stringify(status)], { type: "application/json" }), { upsert: true });
    return reply({ error: uploaded ? "Backup terkirim tetapi verifikasi atau penyelesaian gagal; coba kembali" : "Backup eksternal gagal; periksa kunci dan izin penyimpanan tujuan" }, 500);
  }
});