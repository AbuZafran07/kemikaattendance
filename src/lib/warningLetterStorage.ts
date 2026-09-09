import { supabase } from "@/integrations/supabase/client";
import logger from "@/lib/logger";
import { generateWarningLetterPDF, type WarningLetterData } from "@/lib/warningLetterPdfGenerator";
import logo from "@/assets/logo.png";

const BUCKET = "unlock-letters";

const storagePath = (userId: string, actionId: string) => `${userId}/sp/${actionId}.pdf`;

export const getWarningLetterSignedUrl = async (path: string): Promise<string | null> => {
  if (!path) return null;
  if (path.startsWith("http")) return path;

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) {
    logger.error("Failed to sign warning letter URL:", error);
    return null;
  }
  return data.signedUrl;
};

/**
 * Ensure the SP document exists: generate the PDF, upload it (admin/HR only) and
 * persist document_url. Returns a usable URL (signed URL or blob URL fallback).
 */
export const ensureWarningLetterDocument = async (
  userId: string,
  data: WarningLetterData,
  existingPath?: string | null,
): Promise<string | null> => {
  if (existingPath) {
    const signed = await getWarningLetterSignedUrl(existingPath);
    if (signed) return signed;
  }

  const blob = await generateWarningLetterPDF(data, logo);
  const path = storagePath(userId, data.id);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: "application/pdf", upsert: true });

  if (uploadError) {
    // Employees have no upload permission on this bucket — serve locally instead.
    logger.error("Warning letter upload skipped:", uploadError);
    return URL.createObjectURL(blob);
  }

  const { error: updateError } = await supabase
    .from("disciplinary_actions")
    .update({ document_url: path })
    .eq("id", data.id);

  if (updateError) {
    logger.error("Failed to store warning letter path:", updateError);
  }

  return (await getWarningLetterSignedUrl(path)) ?? URL.createObjectURL(blob);
};
