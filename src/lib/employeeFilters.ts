// Departments exempt from attendance requirements (BOD & Komisaris)
export const ATTENDANCE_EXEMPT_DEPARTMENTS = ["BOD", "Komisaris"];

// Check if an employee is exempt from attendance tracking
export const isAttendanceExempt = (departemen: string): boolean => {
  return ATTENDANCE_EXEMPT_DEPARTMENTS.includes(departemen);
};

// Filter profiles to only include attendance-required, active employees
export const filterAttendanceRequiredProfiles = <T extends { departemen: string; status?: string | null }>(
  profiles: T[]
): T[] => {
  return profiles.filter(
    (p) => !isAttendanceExempt(p.departemen) && (p.status === "Active" || p.status === undefined)
  );
};

// Check if employee status is considered "historical" (no longer active in the company)
export const isHistoricalStatus = (status?: string | null): boolean => {
  return status === "Inactive" || status === "Resigned";
};
