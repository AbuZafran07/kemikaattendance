import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { authenticateCronRequest } from "../_shared/cron-auth.ts";
import { getAllowedOrigin } from "../_shared/cors.ts";
import { collectBackup, expiredBackupNames, PREFIX } from "./backup.ts";

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
  let action: "status" | "backup";
  try {
    const body = await request.json();
    if (!body || !["status", "backup"].includes(body.action) || Object.keys(body).some(k => k !== "action")) return reply({ error: "Invalid request" }, 400);
    action = body.action;
  } catch { return reply({ error: "Invalid request" }, 400); }
  const externalKey = Deno.env.get("EXTERNAL_BACKUP_SECRET_KEY");
  const previous = await source.storage.from("backups").download(STATUS_FILE);
  let last: Record<string, unknown> = {};
  if (previous.data) { try { last = JSON.parse(await previous.data.text()); } catch { /* no status yet */ } }
  if (action === "status") return reply({ configured: !!externalKey, ...last });
  if (!externalKey) return reply({ error: "Kunci backup eksternal belum tersedia" }, 503);
  const target = createClient(DESTINATION, externalKey, { auth: { persistSession: false } });
  let uploaded = false;
  try {
    const bucket = await target.storage.getBucket("backups");
    if (bucket.error || !bucket.data || bucket.data.public) return reply({ error: "Bucket backups tujuan harus tersedia dan bersifat privat" }, 409);
    const backup = await collectBackup(async (table, from, to) => {
      const result = await source.from(table).select("*").order("id").range(from, to);
      if (result.error) throw new Error("Data export failed");
      return result.data ?? [];
    });
    const json = JSON.stringify(backup);
    const file = `${PREFIX}/backup-${backup.created_at.replace(/[:.]/g, "-")}.json`;
    const upload = await target.storage.from("backups").upload(file, new Blob([json], { type: "application/json" }), { upsert: false });
    if (upload.error) throw new Error("Upload failed");
    uploaded = true;
    const readback = await target.storage.from("backups").download(file);
    if (readback.error || !readback.data || await readback.data.text() !== json) throw new Error("Verification failed");
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
    const status = { last_backup_at: backup.created_at, last_backup_file: file, records: Object.values(backup.data).reduce((sum, rows) => sum + rows.length, 0), last_attempt_at: new Date().toISOString(), last_attempt_success: true };
    const saved = await source.storage.from("backups").upload(STATUS_FILE, new Blob([JSON.stringify(status)], { type: "application/json" }), { upsert: true });
    if (saved.error) throw new Error("Status save failed");
    return reply({ success: true, ...status });
  } catch {
    const status = { ...last, last_attempt_at: new Date().toISOString(), last_attempt_success: false };
    await source.storage.from("backups").upload(STATUS_FILE, new Blob([JSON.stringify(status)], { type: "application/json" }), { upsert: true });
    return reply({ error: uploaded ? "Backup terkirim tetapi verifikasi atau penyelesaian gagal; coba kembali" : "Backup eksternal gagal; periksa kunci dan izin penyimpanan tujuan" }, 500);
  }
});