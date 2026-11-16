import { sendFcm, type PushResult } from './fcm.ts';

export interface PushRow { id: string; user_id: string; title: string; message: string; attendance_date: string | null; fcm_token: string; push_claim: string }
export interface PushStore {
  claim(): Promise<PushRow[]>;
  finish(row: PushRow, status: PushResult['status']): Promise<void>;
}

export async function drainAttendancePush(store: PushStore, send = sendFcm) {
  const rows = await store.claim();
  const counts = { claimed: rows.length, sent: 0, unregistered: 0, failed: 0 };
  for (const row of rows) {
    let result: PushResult;
    try {
      result = await send(row.fcm_token, row.title, row.message, {
        notification_id: row.id,
        path: row.attendance_date ? `/employee/attendance-history?date=${row.attendance_date}` : '/employee/notifications',
      });
    } catch { result = { status: 'failed', httpStatus: 0 }; }
    // Do not release a claim after a successful send if persistence fails:
    // the lease protects overlapping workers and reduces crash-window duplicates.
    await store.finish(row, result.status);
    counts[result.status]++;
  }
  return counts;
}

export function attendancePushStore(client: any): PushStore {
  return {
    async claim() {
      const { data, error } = await client.rpc('claim_attendance_push');
      if (error) throw error;
      return data || [];
    },
    async finish(row, status) {
      const { error } = await client.rpc('finish_attendance_push', {
        p_id: row.id, p_claim: row.push_claim, p_token: row.fcm_token, p_status: status,
      });
      if (error) throw error;
    },
  };
}