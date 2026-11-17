export const TABLES = ["profiles", "attendance", "leave_requests", "overtime_requests", "business_travel_requests", "payroll_periods", "payroll", "payroll_overrides", "employee_loans", "loan_installments"];
export const PREFIX = "kemika-attendance";
export const RETENTION = 14;

export async function collectBackup(readPage: (table: string, from: number, to: number) => Promise<Record<string, unknown>[]>, now = new Date()) {
  const data: Record<string, Record<string, unknown>[]> = {};
  for (const table of TABLES) {
    data[table] = [];
    for (let from = 0; ; from += 1000) {
      const rows = await readPage(table, from, from + 999);
      data[table].push(...rows);
      if (rows.length < 1000) break;
    }
  }
  return { version: "1.0", app: "Kemika Attendance", created_at: now.toISOString(), type: "external", tables: TABLES, data };
}

export function expiredBackupNames(files: { name: string }[]) {
  return files.filter(f => /^backup-\d{4}-\d{2}-\d{2}T[\d-]+Z\.json$/.test(f.name))
    .sort((a, b) => b.name.localeCompare(a.name)).slice(RETENTION).map(f => `${PREFIX}/${f.name}`);
}