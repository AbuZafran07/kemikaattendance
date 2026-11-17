// Shared table discovery + export for all backup functions. Pure logic (no Deno APIs) so it is testable.
export const EXCLUDED_TABLES: Record<string, string> = { geocoding_cache: "hanya cache alamat, dapat dibangun ulang" };
export const PAGE_SIZE = 1000;
export type BackupTable = { table_name: string; pk_columns: string[] };
// deno-lint-ignore no-explicit-any
type Client = any;

export function selectBackupTables(all: BackupTable[], excluded = EXCLUDED_TABLES) {
  const tables = all.filter(t => !(t.table_name in excluded)).sort((a, b) => a.table_name.localeCompare(b.table_name));
  const skipped = all.filter(t => t.table_name in excluded).map(t => ({ table: t.table_name, reason: excluded[t.table_name] }));
  return { tables, skipped };
}

export async function listBackupTables(client: Client) {
  const { data, error } = await client.rpc("list_backup_tables");
  if (error || !Array.isArray(data) || !data.length) throw new Error("Daftar tabel backup tidak tersedia");
  return selectBackupTables(data as BackupTable[]);
}

/** Reads one page ordered by the table's primary key (falls back to created_at / unordered for tables without one). */
export function tablePageReader(client: Client, tables: BackupTable[]) {
  const pk = new Map(tables.map(t => [t.table_name, t.pk_columns]));
  return async (table: string, from: number, to: number) => {
    let q = client.from(table).select("*");
    const cols = pk.get(table) ?? [];
    for (const c of cols.length ? cols : ["created_at"]) q = q.order(c, { ascending: true });
    const r = await q.range(from, to);
    if (r.error) throw new Error(`Gagal ambil ${table}`);
    return (r.data ?? []) as Record<string, unknown>[];
  };
}

export async function collectTables(names: string[], readPage: (t: string, from: number, to: number) => Promise<Record<string, unknown>[]>) {
  const data: Record<string, Record<string, unknown>[]> = {};
  for (const table of names) {
    data[table] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const rows = await readPage(table, from, from + PAGE_SIZE - 1);
      data[table].push(...rows);
      if (rows.length < PAGE_SIZE) break;
    }
  }
  return data;
}

export function buildManifest(data: Record<string, unknown[]>, skipped: { table: string; reason: string }[], now = new Date()) {
  const row_counts = Object.fromEntries(Object.entries(data).map(([t, rows]) => [t, rows.length]));
  return { created_at: now.toISOString(), table_count: Object.keys(data).length, total_records: Object.values(row_counts).reduce((a, b) => a + b, 0), row_counts, skipped_tables: skipped };
}

/** Returns mismatch descriptions between manifest counts in the file and exact source counts. */
export function countMismatches(fileCounts: Record<string, number>, sourceCounts: Record<string, number>) {
  const out: string[] = [];
  for (const t of new Set([...Object.keys(fileCounts), ...Object.keys(sourceCounts)])) {
    if (fileCounts[t] !== sourceCounts[t]) out.push(`${t}: file ${fileCounts[t] ?? "-"} vs sumber ${sourceCounts[t] ?? "-"}`);
  }
  return out;
}

export async function exactCounts(client: Client, names: string[]) {
  const out: Record<string, number> = {};
  for (const t of names) {
    const r = await client.from(t).select("*", { count: "exact", head: true });
    if (r.error || r.count == null) throw new Error(`Gagal menghitung ${t}`);
    out[t] = r.count;
  }
  return out;
}
