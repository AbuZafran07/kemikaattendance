import { supabase } from "@/integrations/supabase/client";
import logger from "@/lib/logger";

interface OfficeLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
}

interface ValidationResult {
  isValid: boolean;
  nearestOffice: OfficeLocation | null;
  distance: number;
}

// Calculate distance between two GPS coordinates using Haversine formula
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Fetch office locations from database
export async function fetchOfficeLocations(): Promise<OfficeLocation[]> {
  const { data, error } = await supabase.rpc("get_office_locations");

  if (error || !data) {
    logger.error("Error fetching office locations:", error);
    return [];
  }

  return data as unknown as OfficeLocation[];
}

// Check if user is hybrid worker (can check in from anywhere)
export async function isHybridWorker(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('work_type')
    .eq('id', userId)
    .single();

  if (error || !data) {
    logger.error("Error fetching work type:", error);
    return false;
  }

  return data.work_type === 'wfa';
}

// Validate GPS coordinates against all office locations
export async function validateGPSLocation(userLat: number, userLon: number, userId?: string): Promise<ValidationResult> {
  // If userId is provided, check if they are a hybrid worker
  if (userId) {
    const isHybrid = await isHybridWorker(userId);
    if (isHybrid) {
      // Hybrid workers can check in from anywhere
      const offices = await fetchOfficeLocations();
      let nearestOffice: OfficeLocation | null = null;
      let minDistance = Infinity;

      for (const office of offices) {
        const distance = calculateDistance(userLat, userLon, office.latitude, office.longitude);
        if (distance < minDistance) {
          minDistance = distance;
          nearestOffice = office;
        }
      }

      return {
        isValid: true, // Always valid for hybrid workers
        nearestOffice,
        distance: Math.round(minDistance),
      };
    }
  }

  const offices = await fetchOfficeLocations();

  if (offices.length === 0) {
    // No offices configured, consider valid
    return {
      isValid: true,
      nearestOffice: null,
      distance: 0,
    };
  }

  let nearestOffice: OfficeLocation | null = null;
  let minDistance = Infinity;

  for (const office of offices) {
    const distance = calculateDistance(userLat, userLon, office.latitude, office.longitude);

    if (distance < minDistance) {
      minDistance = distance;
      nearestOffice = office;
    }
  }

  const isValid = nearestOffice ? minDistance <= nearestOffice.radius : false;

  return {
    isValid,
    nearestOffice,
    distance: Math.round(minDistance),
  };
}

// Fetch work hours settings from database using SECURITY DEFINER function
// Uses get_effective_work_hours which automatically considers special periods (Ramadhan, etc.)
async function fetchWorkHoursSettings(): Promise<{
  check_in_end: string;
  check_out_start: string;
  late_tolerance_minutes: number;
  early_leave_tolerance_minutes: number;
} | null> {
  // Try effective work hours first (considers special periods)
  const { data: effectiveData, error: effectiveError } = await supabase.rpc("get_effective_work_hours");

  if (!effectiveError && effectiveData) {
    return effectiveData as {
      check_in_end: string;
      check_out_start: string;
      late_tolerance_minutes: number;
      early_leave_tolerance_minutes: number;
    };
  }

  // Fallback to normal work hours
  const { data, error } = await supabase.rpc("get_work_hours");

  if (error || !data) {
    logger.error("Error fetching work hours:", error);
    return null;
  }

  return data as {
    check_in_end: string;
    check_out_start: string;
    late_tolerance_minutes: number;
    early_leave_tolerance_minutes: number;
  };
}

// Determine attendance status based on check-in time
export async function determineAttendanceStatus(checkInTime: Date): Promise<"hadir" | "terlambat"> {
  const config = await fetchWorkHoursSettings();

  if (!config) {
    // Default: 08:00 + 15 min tolerance = 08:15 is late
    const checkInHour = checkInTime.getHours();
    const checkInMinute = checkInTime.getMinutes();
    const totalMinutes = checkInHour * 60 + checkInMinute;
    return totalMinutes > 8 * 60 + 15 ? "terlambat" : "hadir";
  }

  const [endHour, endMinute] = config.check_in_end.split(":").map(Number);
  const lateThreshold = endHour * 60 + endMinute + (config.late_tolerance_minutes || 15);

  const checkInHour = checkInTime.getHours();
  const checkInMinute = checkInTime.getMinutes();
  const checkInTotalMinutes = checkInHour * 60 + checkInMinute;

  return checkInTotalMinutes > lateThreshold ? "terlambat" : "hadir";
}

// Determine if checkout is early departure
export async function determineCheckoutStatus(
  checkOutTime: Date,
  currentStatus: "hadir" | "terlambat",
): Promise<"hadir" | "terlambat" | "pulang cepat"> {
  const config = await fetchWorkHoursSettings();

  if (!config) {
    // Default: before 17:00 is early
    const checkOutHour = checkOutTime.getHours();
    const checkOutMinute = checkOutTime.getMinutes();
    const totalMinutes = checkOutHour * 60 + checkOutMinute;

    if (totalMinutes < 17 * 60) {
      return "pulang cepat";
    }
    return currentStatus;
  }

  const [startHour, startMinute] = config.check_out_start.split(":").map(Number);
  const earlyLeaveThreshold = startHour * 60 + startMinute - (config.early_leave_tolerance_minutes || 0);

  const checkOutHour = checkOutTime.getHours();
  const checkOutMinute = checkOutTime.getMinutes();
  const checkOutTotalMinutes = checkOutHour * 60 + checkOutMinute;

  if (checkOutTotalMinutes < earlyLeaveThreshold) {
    return "pulang cepat";
  }

  return currentStatus;
}