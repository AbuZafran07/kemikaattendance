/**
 * Get optimized image URL for faster loading
 * Uses Supabase Storage transformations when available
 */
export const getOptimizedImageUrl = (
  url: string | null | undefined,
  options: { width?: number; height?: number; quality?: number } = {}
): string => {
  if (!url) return '';
  
  const { width = 100, height = 100, quality = 80 } = options;
  
  // Check if it's a Supabase storage URL
  if (url.includes('supabase') && url.includes('/storage/')) {
    // Add render transformation parameters for Supabase
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}width=${width}&height=${height}&quality=${quality}&resize=cover`;
  }
  
  return url;
};

/**
 * Get initials from a name for avatar fallback
 */
export const getInitials = (name: string): string => {
  if (!name) return '?';
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};
