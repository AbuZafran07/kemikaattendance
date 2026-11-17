import { buildManifest, collectTables } from "../_shared/backup-tables.ts";
export const PREFIX = "kemika-attendance";
export const RETENTION = 14;
export const STALE_HOURS = 36;

export async function collectBackup(tables: string[], skipped: { table: string; reason: string }[], readPage: (table: string, from: number, to: number) => Promise<Record<string, unknown>[]>, now = new Date()) {
  const data = await collectTables(tables, readPage);
  return { version: "2.0", app: "Kemika Attendance", created_at: now.toISOString(), type: "external", tables, manifest: buildManifest(data, skipped, now), data };
}

export function expiredBackupNames(files: { name: string }[]) {
  return files.filter(f => /^backup-\d{4}-\d{2}-\d{2}T[\d-]+Z\.json$/.test(f.name))
    .sort((a, b) => b.name.localeCompare(a.name)).slice(RETENTION).map(f => `${PREFIX}/${f.name}`);
}

/** True when neither destination has a successful backup within STALE_HOURS. */
export function backupIsStale(lastSuccesses: (string | null | undefined)[], now = new Date()) {
  const latest = Math.max(0, ...lastSuccesses.map(s => (s ? Date.parse(s) : 0)).filter(n => !Number.isNaN(n)));
  return now.getTime() - latest > STALE_HOURS * 3600_000;
}
