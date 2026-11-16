export function notificationBadgeTotal(counts: Array<number | null | undefined>): number {
  return counts.reduce<number>((total, count) => total + (count ?? 0), 0);
}