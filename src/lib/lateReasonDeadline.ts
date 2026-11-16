export function isWithinLateReasonDeadline(checkIn: string, deadlineHours: number, serverNow: number) {
  return Number.isFinite(serverNow) && serverNow <= Date.parse(checkIn) + deadlineHours * 3_600_000;
}