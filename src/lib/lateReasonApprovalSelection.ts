export interface SelectableLateReason {
  id: string;
  status: string;
}

export function selectedPendingIds(rows: SelectableLateReason[], selected: string[]): string[] {
  const pending = new Set(rows.filter(row => row.status === "pending").map(row => row.id));
  return [...new Set(selected)].filter(id => pending.has(id));
}

export async function approveSelectedLateReasons(
  ids: string[],
  approve: (id: string) => PromiseLike<{ error: unknown }>,
) {
  const approved: string[] = [];
  const failed: string[] = [];
  for (const id of [...new Set(ids)]) {
    try {
      const result = await approve(id);
      (result.error ? failed : approved).push(id);
    } catch {
      failed.push(id);
    }
  }
  return { approved, failed };
}