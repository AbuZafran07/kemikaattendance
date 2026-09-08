import { supabase } from "@/integrations/supabase/client";
import logger from "@/lib/logger";

/**
 * Upload a generated unlock letter PDF to the private 'unlock-letters' bucket.
 * Returns the storage path (not a public URL — bucket is private, resolve with
 * getUnlockLetterSignedUrl when displaying).
 */
export const uploadUnlockLetterPdf = async (pdfBlob: Blob, userId: string, letterId: string): Promise<string> => {
  const path = `${userId}/${letterId}.pdf`;

  const { data, error } = await supabase.storage
    .from("unlock-letters")
    .upload(path, pdfBlob, { contentType: "application/pdf", upsert: true });

  if (error) {
    logger.error("Failed to upload unlock letter PDF:", error);
    throw new Error(`Gagal mengunggah surat: ${error.message}`);
  }

  return data.path;
};

export const getUnlockLetterSignedUrl = async (documentPath: string): Promise<string | null> => {
  if (!documentPath) return null;
  if (documentPath.startsWith("http")) return documentPath;

  const { data, error } = await supabase.storage
    .from("unlock-letters")
    .createSignedUrl(documentPath, 3600);

  if (error) {
    logger.error("Failed to get unlock letter signed URL:", error);
    return null;
  }

  return data.signedUrl;
};
