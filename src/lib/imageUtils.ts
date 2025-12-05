// In-memory cache for image URLs
const imageCache = new Map<string, string>();

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
  
  // Generate cache key
  const cacheKey = `${url}-${width}-${height}-${quality}`;
  
  // Check cache first
  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey)!;
  }
  
  let optimizedUrl = url;
  
  // Check if it's a Supabase storage URL
  if (url.includes('supabase') && url.includes('/storage/')) {
    // Add render transformation parameters for Supabase
    const separator = url.includes('?') ? '&' : '?';
    optimizedUrl = `${url}${separator}width=${width}&height=${height}&quality=${quality}&resize=cover`;
  }
  
  // Store in cache
  imageCache.set(cacheKey, optimizedUrl);
  
  return optimizedUrl;
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

/**
 * Clear the image URL cache
 */
export const clearImageCache = (): void => {
  imageCache.clear();
};

/**
 * Preload an image into browser cache
 */
export const preloadImage = (url: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = url;
  });
};

/**
 * Preload multiple images
 */
export const preloadImages = async (urls: string[]): Promise<void> => {
  await Promise.allSettled(urls.map(preloadImage));
};
