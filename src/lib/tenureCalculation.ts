/**
 * Calculate employee tenure using payroll cutoff system.
 * 
 * In the cutoff system (e.g., cutoffDay=21):
 * - 1 month = from the 21st of month X to the 20th of month X+1
 * - Join Dec 21 → Jan 20 = 1 month, Jan 21 → Feb 20 = 1 month, etc.
 * 
 * @param joinDate Employee join date
 * @param refDate Reference date (e.g., Idul Fitri date)
 * @param cutoffDay The cutoff day (default 21)
 * @returns { fullMonths, remainingDays, totalMonthsFraction }
 */
export function calculateCutoffTenure(
  joinDate: Date,
  refDate: Date,
  cutoffDay: number = 21
): { fullMonths: number; remainingDays: number; totalMonthsFraction: number } {
  if (refDate.getTime() < joinDate.getTime()) {
    return { fullMonths: 0, remainingDays: 0, totalMonthsFraction: 0 };
  }

  // In cutoff system, the period ends on cutoffDay-1 of the next month.
  // E.g., period Feb 21 – Mar 20 is 1 full month. So Mar 20 should complete that period.
  // We add 1 day to refDate so the last day of a period is counted as completing the month.
  const adjustedRef = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate() + 1);

  // Determine which cutoff period each date falls in
  // If day >= cutoffDay → period started this month at cutoffDay
  // If day < cutoffDay → period started previous month at cutoffDay

  const jDay = joinDate.getDate();
  let jPeriodMonth = joinDate.getMonth();
  let jPeriodYear = joinDate.getFullYear();
  let jDayInPeriod: number;

  if (jDay >= cutoffDay) {
    jDayInPeriod = jDay - cutoffDay;
  } else {
    jPeriodMonth -= 1;
    if (jPeriodMonth < 0) {
      jPeriodMonth = 11;
      jPeriodYear -= 1;
    }
    // Days from previous month's cutoff to this date
    const daysInPrevMonth = new Date(joinDate.getFullYear(), joinDate.getMonth(), 0).getDate();
    jDayInPeriod = jDay + (daysInPrevMonth - cutoffDay);
  }

  const rDay = refDate.getDate();
  let rPeriodMonth = refDate.getMonth();
  let rPeriodYear = refDate.getFullYear();
  let rDayInPeriod: number;

  if (rDay >= cutoffDay) {
    rDayInPeriod = rDay - cutoffDay;
  } else {
    rPeriodMonth -= 1;
    if (rPeriodMonth < 0) {
      rPeriodMonth = 11;
      rPeriodYear -= 1;
    }
    const daysInPrevMonth = new Date(refDate.getFullYear(), refDate.getMonth(), 0).getDate();
    rDayInPeriod = rDay + (daysInPrevMonth - cutoffDay);
  }

  // Calculate months between the two cutoff periods
  let fullMonths = (rPeriodYear - jPeriodYear) * 12 + (rPeriodMonth - jPeriodMonth);
  let remainingDays = rDayInPeriod - jDayInPeriod;

  if (remainingDays < 0) {
    fullMonths -= 1;
    remainingDays += 30; // Use 30 as per Permenaker regulation
  }

  fullMonths = Math.max(fullMonths, 0);
  remainingDays = Math.max(remainingDays, 0);

  const totalMonthsFraction = fullMonths + remainingDays / 30;

  return { fullMonths, remainingDays, totalMonthsFraction };
}
