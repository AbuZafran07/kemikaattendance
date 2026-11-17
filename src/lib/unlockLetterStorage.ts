import { supabase } from "@/integrations/supabase/client";
import logger from "@/lib/logger";
import { generateUnlockLetterPDF } from "@/lib/unlockLetterPdfGenerator";
import logo from "@/assets/logo.png";

/** Render existing signed records with the current layout without changing their audit data. */
export const getUnlockLetterPreviewUrl = async (letterId: string): Promise<string> => {
  const { data: letter, error } = await supabase.from("account_unlock_letters")
    .select("letter_number, user_id, statement_text, employee_signature_data, employee_signed_at, hr_signature_data, hr_signed_by, hr_signed_at")
    .eq("id", letterId).single();
  if (error || !letter) throw new Error("Surat tidak dapat dimuat");
  const { data: employee } = await supabase.from("profiles")
    .select("full_name, nik, jabatan, departemen").eq("id", letter.user_id).single();
  if (!employee) throw new Error("Data karyawan tidak dapat dimuat");
  const { data: hr } = letter.hr_signed_by
    ? await supabase.from("profiles").select("full_name").eq("id", letter.hr_signed_by).maybeSingle()
    : { data: null };
  const blob = await generateUnlockLetterPDF({
    ...letter,
    employee_name: employee.full_name,
    nik: employee.nik,
    jabatan: employee.jabatan,
    departemen: employee.departemen,
    hr_signed_by_name: hr?.full_name,
  }, logo);
  return URL.createObjectURL(blob);
};

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
