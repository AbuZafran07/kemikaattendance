import { supabase } from "@/integrations/supabase/client";

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
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Fetch office locations from database
export async function fetchOfficeLocations(): Promise<OfficeLocation[]> {
  const { data, error } = await supabase.rpc('get_office_locations');
  
  if (error || !data) {
    console.error('Error fetching office locations:', error);
    return [];
  }
  
  return data as unknown as OfficeLocation[];
}

// Validate GPS coordinates against all office locations
export async function validateGPSLocation(
  userLat: number,
  userLon: number
): Promise<ValidationResult> {
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
    const distance = calculateDistance(
      userLat,
      userLon,
      office.latitude,
      office.longitude
    );
    
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

// Determine attendance status based on check-in time
export async function determineAttendanceStatus(
  checkInTime: Date
): Promise<'hadir' | 'terlambat'> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'work_hours')
    .maybeSingle();
  
  if (error || !data) {
    // Default: 09:00 is late
    const checkInHour = checkInTime.getHours();
    const checkInMinute = checkInTime.getMinutes();
    const totalMinutes = checkInHour * 60 + checkInMinute;
    return totalMinutes > (9 * 60 + 15) ? 'terlambat' : 'hadir';
  }
  
  const config = data.value as {
    check_in_end: string;
    late_tolerance_minutes: number;
  };
  
  const [endHour, endMinute] = config.check_in_end.split(':').map(Number);
  const lateThreshold = endHour * 60 + endMinute + (config.late_tolerance_minutes || 0);
  
  const checkInHour = checkInTime.getHours();
  const checkInMinute = checkInTime.getMinutes();
  const checkInTotalMinutes = checkInHour * 60 + checkInMinute;
  
  return checkInTotalMinutes > lateThreshold ? 'terlambat' : 'hadir';
}
