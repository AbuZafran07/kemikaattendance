/**
 * Compress an image file before upload
 * @param file - The original image file
 * @param options - Compression options
 * @returns Promise<Blob> - Compressed image blob
 */
export const compressImage = async (
  file: File,
  options: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    outputType?: "image/jpeg" | "image/png" | "image/webp";
  } = {}
): Promise<Blob> => {
  const {
    maxWidth = 800,
    maxHeight = 800,
    quality = 0.8,
    outputType = "image/jpeg",
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      reject(new Error("Could not get canvas context"));
      return;
    }

    img.onload = () => {
      let { width, height } = img;

      // Calculate new dimensions while maintaining aspect ratio
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;

      // Draw image with smooth scaling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            console.log(
              `Image compressed: ${(file.size / 1024).toFixed(1)}KB -> ${(blob.size / 1024).toFixed(1)}KB (${Math.round((1 - blob.size / file.size) * 100)}% reduction)`
            );
            resolve(blob);
          } else {
            reject(new Error("Failed to compress image"));
          }
        },
        outputType,
        quality
      );
    };

    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };

    img.src = URL.createObjectURL(file);
  });
};

/**
 * Compress image for employee photo (optimized settings)
 */
export const compressEmployeePhoto = async (file: File): Promise<Blob> => {
  return compressImage(file, {
    maxWidth: 400,
    maxHeight: 400,
    quality: 0.85,
    outputType: "image/jpeg",
  });
};

/**
 * Convert blob to File object
 */
export const blobToFile = (blob: Blob, filename: string): File => {
  return new File([blob], filename, { type: blob.type });
};
