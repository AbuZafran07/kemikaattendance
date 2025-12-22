import { supabase } from "@/integrations/supabase/client";
import logger from "@/lib/logger";

/**
 * Upload attendance photo to storage bucket
 * @param photoBlob - The photo blob to upload
 * @param userId - The user's ID
 * @param type - Either 'checkin' or 'checkout'
 * @returns The public URL of the uploaded photo
 */
export const uploadAttendancePhoto = async (
  photoBlob: Blob,
  userId: string,
  type: 'checkin' | 'checkout'
): Promise<string> => {
  const timestamp = Date.now();
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const filename = `${userId}/${date}/${type}_${timestamp}.jpg`;

  logger.debug('Uploading attendance photo:', { filename, size: photoBlob.size });

  const { data, error } = await supabase.storage
    .from('attendance-photos')
    .upload(filename, photoBlob, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (error) {
    logger.error('Failed to upload attendance photo:', error);
    throw new Error(`Gagal mengunggah foto: ${error.message}`);
  }

  // Get the public URL for the uploaded photo
  const { data: urlData } = supabase.storage
    .from('attendance-photos')
    .getPublicUrl(data.path);

  logger.debug('Photo uploaded successfully:', { path: data.path });
  
  return data.path; // Store path, not full URL (more flexible for signed URLs)
};

/**
 * Get a signed URL for viewing an attendance photo
 * @param photoPath - The storage path of the photo
 * @returns Signed URL valid for 1 hour
 */
export const getAttendancePhotoUrl = async (photoPath: string): Promise<string | null> => {
  if (!photoPath) return null;
  
  // If it's already a full URL (e.g., old data URL), return as-is
  if (photoPath.startsWith('data:') || photoPath.startsWith('http')) {
    return photoPath;
  }

  const { data, error } = await supabase.storage
    .from('attendance-photos')
    .createSignedUrl(photoPath, 3600); // 1 hour expiry

  if (error) {
    logger.error('Failed to get signed URL:', error);
    return null;
  }

  return data.signedUrl;
};

/**
 * Get signed URLs for multiple photos at once
 * @param photoPaths - Array of storage paths
 * @returns Map of path to signed URL
 */
export const getAttendancePhotoUrls = async (
  photoPaths: (string | null)[]
): Promise<Map<string, string>> => {
  const urlMap = new Map<string, string>();
  
  const validPaths = photoPaths.filter((p): p is string => !!p && !p.startsWith('data:') && !p.startsWith('http'));
  
  if (validPaths.length === 0) return urlMap;

  // Create signed URLs in parallel
  const urlPromises = validPaths.map(async (path) => {
    const url = await getAttendancePhotoUrl(path);
    if (url) {
      urlMap.set(path, url);
    }
  });

  await Promise.all(urlPromises);
  
  return urlMap;
};