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

const KEEP_COUNT = 30;
const BUCKETS_TO_BACKUP = ["attendance-photos", "employee-photos", "business-travel-docs"];
// Batas waktu aman per invocation untuk fase file (edge function max ±400s)
const FILE_PHASE_BUDGET_MS = 110_000;
const FILE_BATCH = 6;

// Ambil SEMUA baris (PostgREST default hanya 1000 baris per request)
async function fetchAllRows(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  table: string,
): Promise<Record<string, unknown>[]> {
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



function corsHeaders(origin: string | null) {
  const allow = !origin || origin.startsWith("https://") || origin.startsWith("http://localhost")
    ? origin ?? "*"
    : "";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-cron-secret, x-internal-key",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

async function getGoogleAccessToken(serviceAccount: {
  client_email: string;
  private_key: string;
}) {
  const header = { alg: "RS256", typ: "JWT" };
  const nowSec = Math.floor(Date.now() / 1000);
  const claim = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    iat: nowSec,
    exp: nowSec + 3600,
  };

  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

  const signingInput = `${encode(header)}.${encode(claim)}`;

  const pem = serviceAccount.private_key
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");

  const keyBuffer = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${signingInput}.${signatureB64}`,
    }),
  });

  if (!tokenResponse.ok) {
    const errText = await tokenResponse.text();
    throw new Error(`Gagal mendapatkan Google access token: ${errText}`);
  }
  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) throw new Error("Google access token tidak diterima");
  return tokenData.access_token as string;
}

async function createDriveFolder(accessToken: string, name: string, parent: string) {
  const res = await fetch("https://www.googleapis.com/drive/v3/files?supportsAllDrives=true", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      parents: [parent],
      mimeType: "application/vnd.google-apps.folder",
    }),
  });
  if (!res.ok) throw new Error(`Gagal membuat folder Drive "${name}": ${await res.text()}`);
  const data = await res.json();
  return data.id as string;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(origin) });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const cronSecret = Deno.env.get("GDRIVE_CRON_SECRET") ?? Deno.env.get("BUDGET_EXPENSE_SECRET");
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Auth: internal chain call, shared cron secret, atau admin bearer token
  const isInternal = req.headers.get("x-internal-key") === serviceRoleKey;
  const isCron = !!cronSecret && req.headers.get("x-cron-secret") === cronSecret;
  if (!isInternal && !isCron) {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401, origin);
    }
    const authClient = createClient(supabaseUrl, anonKey);
    const { data: userData, error: userErr } = await authClient.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401, origin);
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Forbidden" }, 403, origin);
  }

  let isTest = false;
  let phase: "db" | "files" = "db";
  try {
    const body = await req.json().catch(() => ({}));
    isTest = body?.test === true;
    if (body?.phase === "files") phase = "files";
  } catch {
    isTest = false;
  }

  const readConfig = async () => {
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "gdrive_backup_config")
      .maybeSingle();
    return (data?.value ?? {}) as Record<string, unknown>;
  };

  const saveConfig = async (patch: Record<string, unknown>) => {
    const current = await readConfig();
    await supabase.from("system_settings").upsert(
      {
        key: "gdrive_backup_config",
        value: { ...current, ...patch },
        description: "Konfigurasi auto backup ke Google Drive",
      },
      { onConflict: "key" },
    );
  };

  const chainFilePhase = () => {
    // panggil dirinya sendiri untuk melanjutkan sisa file (tanpa menunggu selesai)
    const p = fetch(`${supabaseUrl}/functions/v1/gdrive-backup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-key": serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ phase: "files" }),
    })
      .then((r) => console.log("Chain fase file dipanggil:", r.status))
      .catch((e) => console.error("Gagal chaining fase file:", e));
    // pastikan request tetap terkirim walau response sudah dikembalikan
    // deno-lint-ignore no-explicit-any
    const rt = (globalThis as any).EdgeRuntime;
    if (rt?.waitUntil) rt.waitUntil(p);
  };

  try {
    const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    if (!serviceAccountJson) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON belum dikonfigurasi");
    }
    const serviceAccount = JSON.parse(serviceAccountJson);
    const rawFolderId = Deno.env.get("GDRIVE_FOLDER_ID")?.trim();
    if (!rawFolderId) throw new Error("GDRIVE_FOLDER_ID belum dikonfigurasi");
    const folderUrlMatch = rawFolderId.match(/\/folders\/([^/?#]+)/);
    const gdriveFolderId = (folderUrlMatch?.[1] ?? rawFolderId).trim();
    if (!/^[A-Za-z0-9_-]+$/.test(gdriveFolderId)) {
      throw new Error("Format GDRIVE_FOLDER_ID tidak valid");
    }

    const accessToken = await getGoogleAccessToken(serviceAccount);

    // ================= TEST MODE =================
    if (isTest) {
      let folderRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${gdriveFolderId}?fields=id,name,mimeType&supportsAllDrives=true`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!folderRes.ok && gdriveFolderId.startsWith("0A")) {
        const sharedDriveRes = await fetch(
          `https://www.googleapis.com/drive/v3/drives/${gdriveFolderId}?fields=id,name`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (sharedDriveRes.ok) {
          const sharedDrive = await sharedDriveRes.json();
          return json(
            {
              success: true,
              test: true,
              folder_name: sharedDrive.name,
              folder_id: sharedDrive.id,
              shared_drive: true,
            },
            200,
            origin,
          );
        }
        folderRes = sharedDriveRes;
      }
      if (!folderRes.ok) {
        const errText = await folderRes.text();
        console.error("Folder check failed:", folderRes.status, errText);
        if (folderRes.status === 404) {
          throw new Error(
            `Folder Google Drive (ID: ${gdriveFolderId}) tidak ditemukan. ` +
              `Pastikan: (1) ID folder benar — ambil dari URL folder setelah /folders/, ` +
              `(2) folder sudah di-share ke ${serviceAccount.client_email} dengan akses Editor, ` +
              `(3) untuk Shared Drive, tambahkan service account sebagai member (Content manager).`,
          );
        }
        throw new Error(`Folder Google Drive tidak dapat diakses: ${errText}`);
      }

      const folder = await folderRes.json();
      if (folder.mimeType !== "application/vnd.google-apps.folder") {
        throw new Error("GDRIVE_FOLDER_ID harus menunjuk ke folder Google Drive");
      }
      return json(
        { success: true, test: true, folder_name: folder.name, folder_id: folder.id },
        200,
        origin,
      );
    }

    const configValue = await readConfig();

    if (isCron && !configValue?.enabled) {
      return json({ message: "Google Drive backup is disabled" }, 200, origin);
    }

    // ================= FASE FILE (resumable) =================
    if (phase === "files") {
      const started = Date.now();
      const state = (configValue.files_state ?? {}) as {
        root_id?: string;
        folder_name?: string;
        buckets?: Record<
          string,
          {
            folder_id?: string;
            prefixes?: string[];
            pi?: number;
            cursor?: string;
            done?: boolean;
          }
        >;
        uploaded?: number;
        failed?: number;
        done?: boolean;
      };

      if (state.done) {
        return json({ success: true, phase: "files", message: "Sudah selesai" }, 200, origin);
      }

      const dateStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      if (!state.root_id) {
        state.folder_name = `files-${dateStr}`;
        state.root_id = await createDriveFolder(accessToken, state.folder_name, gdriveFolderId);
        state.buckets = {};
        state.uploaded = 0;
        state.failed = 0;
        await saveConfig({ files_state: state, files_folder: state.folder_name });
      }
      state.buckets = state.buckets ?? {};

      // Daftar "prefix" (folder level-1) di dalam bucket — didata sekali lalu disimpan
      const listPrefixes = async (bucket: string): Promise<string[]> => {
        const { data, error } = await supabase.storage.from(bucket).list("", { limit: 1000 });
        if (error) {
          console.error(`Gagal list bucket ${bucket}:`, error.message);
          return [];
        }
        const prefixes: string[] = [];
        let hasRootFiles = false;
        for (const item of data ?? []) {
          if ((item as { id: string | null }).id === null) prefixes.push(item.name);
          else hasRootFiles = true;
        }
        if (hasRootFiles) prefixes.unshift("");
        return prefixes;
      };

      const listFilesInPrefix = async (bucket: string, prefix: string): Promise<string[]> => {
        const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
        if (error) {
          console.error(`Gagal list ${bucket}/${prefix}:`, error.message);
          return [];
        }
        return (data ?? [])
          .filter((item) => (item as { id: string | null }).id !== null)
          .map((item) => (prefix ? `${prefix}/${item.name}` : item.name))
          .sort();
      };

      const uploadFile = async (bucket: string, filePath: string, parentId: string) => {
        try {
          const { data: fileBlob, error } = await supabase.storage.from(bucket).download(filePath);
          if (error || !fileBlob) {
            console.error("Download gagal:", bucket, filePath, error?.message);
            state.failed = (state.failed ?? 0) + 1;
            return;
          }
          const ext = filePath.split(".").pop()?.toLowerCase();
          const mimeMap: Record<string, string> = {
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            png: "image/png",
            gif: "image/gif",
            webp: "image/webp",
            pdf: "application/pdf",
            docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          };
          const mimeType = mimeMap[ext || ""] || "application/octet-stream";
          const fileBoundary = `fb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
          const fileMetadata = JSON.stringify({
            name: filePath.replace(/\//g, "_"),
            parents: [parentId],
            mimeType,
          });
          const uint8 = new Uint8Array(await fileBlob.arrayBuffer());
          const metaPart = new TextEncoder().encode(
            `--${fileBoundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${fileMetadata}\r\n--${fileBoundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
          );
          const closePart = new TextEncoder().encode(`\r\n--${fileBoundary}--`);
          const body = new Uint8Array(metaPart.length + uint8.length + closePart.length);
          body.set(metaPart, 0);
          body.set(uint8, metaPart.length);
          body.set(closePart, metaPart.length + uint8.length);

          const res = await fetch(
            "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": `multipart/related; boundary=${fileBoundary}`,
              },
              body,
            },
          );
          if (!res.ok) {
            console.error("Upload file gagal:", filePath, res.status, await res.text());
            state.failed = (state.failed ?? 0) + 1;
            return;
          }
          state.uploaded = (state.uploaded ?? 0) + 1;
        } catch (e) {
          console.error("Upload file error:", filePath, e);
          state.failed = (state.failed ?? 0) + 1;
        }
      };

      let timeUp = false;
      for (const bucket of BUCKETS_TO_BACKUP) {
        if (timeUp) break;
        const bState = (state.buckets[bucket] = state.buckets[bucket] ?? {});
        if (bState.done) continue;
        if (!bState.folder_id) {
          bState.folder_id = await createDriveFolder(accessToken, bucket, state.root_id!);
          await saveConfig({ files_state: state });
        }
        if (!bState.prefixes) {
          bState.prefixes = await listPrefixes(bucket);
          bState.pi = 0;
          console.log(`Bucket ${bucket}: ${bState.prefixes.length} prefix ditemukan`);
          await saveConfig({ files_state: state });
        }

        while ((bState.pi ?? 0) < bState.prefixes.length) {
          if (Date.now() - started > FILE_PHASE_BUDGET_MS) {
            timeUp = true;
            break;
          }
          const prefix = bState.prefixes[bState.pi ?? 0];
          const all = await listFilesInPrefix(bucket, prefix);
          const remaining = bState.cursor ? all.filter((p) => p > bState.cursor!) : all;

          let prefixDone = true;
          for (let i = 0; i < remaining.length; i += FILE_BATCH) {
            if (Date.now() - started > FILE_PHASE_BUDGET_MS) {
              timeUp = true;
              prefixDone = false;
              break;
            }
            const batch = remaining.slice(i, i + FILE_BATCH);
            await Promise.all(batch.map((fp) => uploadFile(bucket, fp, bState.folder_id!)));
            bState.cursor = batch[batch.length - 1];
            await saveConfig({
              files_state: state,
              files_uploaded: state.uploaded ?? 0,
              files_failed: state.failed ?? 0,
              files_last_progress_at: new Date().toISOString(),
            });
          }

          if (prefixDone) {
            bState.pi = (bState.pi ?? 0) + 1;
            bState.cursor = undefined;
            await saveConfig({ files_state: state });
          } else {
            break;
          }
        }

        if ((bState.pi ?? 0) >= bState.prefixes.length) bState.done = true;
      }


      const allDone = BUCKETS_TO_BACKUP.every((b) => state.buckets![b]?.done);
      state.done = allDone;
      await saveConfig({
        files_state: state,
        files_uploaded: state.uploaded ?? 0,
        files_failed: state.failed ?? 0,
        files_done: allDone,
        files_last_progress_at: new Date().toISOString(),
      });

      if (!allDone) chainFilePhase();

      return json(
        {
          success: true,
          phase: "files",
          done: allDone,
          files_uploaded: state.uploaded ?? 0,
          files_failed: state.failed ?? 0,
        },
        200,
        origin,
      );
    }

    // ================= FASE DB (cepat) =================
    const backupData: Record<string, unknown[]> = {};
    let totalRecords = 0;
    for (const table of TABLES) {
      try {
        const rows = await fetchAllRows(supabase, table);
        backupData[table] = rows;
        totalRecords += rows.length;
      } catch (e) {
        console.error(`Error fetching ${table}:`, e instanceof Error ? e.message : e);
        backupData[table] = [];
      }
    }


    const now = new Date();
    const dateStr = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const fileName = `Kemika-Attendance-Backup-${dateStr}.json`;

    const jsonContent = JSON.stringify({
      _meta: {
        app: "Kemika Attendance",
        version: "1.0",
        type: "gdrive_auto_backup",
        exported_at: now.toISOString(),
        tables: TABLES,
        total_records: totalRecords,
      },
      app: "Kemika Attendance",
      version: "1.0",
      created_at: now.toISOString(),
      tables: TABLES,
      data: backupData,
    });

    const boundary = "backup_boundary_kemika_hris";
    const metadata = JSON.stringify({
      name: fileName,
      parents: [gdriveFolderId],
      mimeType: "application/json",
      description: `Kemika Attendance auto backup — ${totalRecords} records`,
    });

    const multipartBody =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${metadata}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      `${jsonContent}\r\n` +
      `--${boundary}--`;

    const uploadResponse = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      },
    );

    if (!uploadResponse.ok) {
      const errText = await uploadResponse.text();
      throw new Error(`Google Drive upload gagal: ${errText}`);
    }
    const uploadResult = await uploadResponse.json();

    // Harian = JSON saja, Mingguan = JSON + file storage.
    // Untuk run otomatis (cron), file hanya diikutkan pada hari mingguan (default Minggu, WIB).
    const filesToggleOn = configValue?.include_files === true;
    const weeklyOnly = configValue?.files_weekly_only !== false;
    const weeklyDay = Number(configValue?.files_weekly_day ?? 0); // 0 = Minggu
    const wibDay = new Date(now.getTime() + 7 * 60 * 60 * 1000).getUTCDay();
    const isWeeklyRun = !isCron || !weeklyOnly || wibDay === weeklyDay;
    const includeFiles = filesToggleOn && isWeeklyRun;


    // Simpan status DB backup SEGERA (tidak menunggu backup file)
    await saveConfig({
      enabled: configValue?.enabled ?? true,
      include_files: filesToggleOn,
      files_weekly_only: weeklyOnly,
      files_weekly_day: weeklyDay,
      last_backup_at: now.toISOString(),
      last_backup_file: fileName,
      last_backup_records: totalRecords,
      last_backup_type: includeFiles ? "weekly" : "daily",
      gdrive_file_id: uploadResult.id,


      ...(includeFiles
        ? {
            files_state: {},
            files_uploaded: 0,
            files_failed: 0,
            files_done: false,
            files_folder: null,
          }
        : {}),
    });

    // Retensi: simpan 30 file JSON terakhir
    try {
      const q =
        `'${gdriveFolderId}' in parents and name contains 'Kemika-Attendance-Backup' and trashed = false`;
      const listResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}` +
          `&orderBy=createdTime&fields=files(id,name,createdTime)&pageSize=100&supportsAllDrives=true&includeItemsFromAllDrives=true`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const listData = await listResponse.json();
      const files = (listData.files || []) as { id: string }[];
      if (files.length > KEEP_COUNT) {
        const toDelete = files.slice(0, files.length - KEEP_COUNT);
        await Promise.all(
          toDelete.map((f) =>
            fetch(`https://www.googleapis.com/drive/v3/files/${f.id}?supportsAllDrives=true`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${accessToken}` },
            }),
          ),
        );
      }
    } catch (e) {
      console.error("Gagal membersihkan backup lama:", e);
    }

    // Retensi folder file: simpan 7 folder terakhir
    if (includeFiles) {
      try {
        const fq =
          `'${gdriveFolderId}' in parents and name contains 'files-' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
        const listFoldersRes = await fetch(
          `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(fq)}` +
            `&orderBy=createdTime&fields=files(id,name)&pageSize=100&supportsAllDrives=true&includeItemsFromAllDrives=true`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        const foldersData = await listFoldersRes.json();
        const folders = (foldersData.files || []) as { id: string }[];
        const KEEP_FOLDERS = 7;
        if (folders.length > KEEP_FOLDERS) {
          const toDeleteFolders = folders.slice(0, folders.length - KEEP_FOLDERS);
          await Promise.all(
            toDeleteFolders.map((f) =>
              fetch(`https://www.googleapis.com/drive/v3/files/${f.id}?supportsAllDrives=true`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${accessToken}` },
              }),
            ),
          );
        }
      } catch (e) {
        console.error("Gagal membersihkan folder file lama:", e);
      }

      // Backup file dijalankan di invocation terpisah (berlanjut otomatis)
      chainFilePhase();
    }

    return json(
      {
        success: true,
        file: fileName,
        gdrive_file_id: uploadResult.id,
        total_records: totalRecords,
        files_backup_started: includeFiles,
      },
      200,
      origin,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("GDrive backup error:", message);
    return json({ error: message }, 500, origin);
  }
});
