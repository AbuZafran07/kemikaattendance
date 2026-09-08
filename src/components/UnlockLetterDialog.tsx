import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Eraser, FileSignature } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { generateUnlockLetterPDF } from "@/lib/unlockLetterPdfGenerator";
import { uploadUnlockLetterPdf } from "@/lib/unlockLetterStorage";
import logo from "@/assets/logo.png";
import logger from "@/lib/logger";

const DEFAULT_STATEMENT =
  "Saya yang bertanda tangan di bawah ini menyatakan telah memahami pelanggaran disiplin kehadiran yang saya lakukan dan berkomitmen untuk memperbaiki kedisiplinan kehadiran saya di masa mendatang. Saya bersedia menerima konsekuensi apabila kembali melakukan pelanggaran serupa di kemudian hari.";

interface UnlockLetterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lockId: string;
  onSubmitted: () => void;
}

const UnlockLetterDialog = ({ open, onOpenChange, lockId, onSubmitted }: UnlockLetterDialogProps) => {
  const { profile, user } = useAuth();
  const { toast } = useToast();
  const sigRef = useRef<SignatureCanvas>(null);
  const [statementText, setStatementText] = useState(DEFAULT_STATEMENT);
  const [isEmpty, setIsEmpty] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClearSignature = () => {
    sigRef.current?.clear();
    setIsEmpty(true);
  };

  const handleSubmit = async () => {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      toast({ title: "Tanda tangan wajib diisi", description: "Silakan tanda tangan di area yang tersedia.", variant: "destructive" });
      return;
    }
    if (!statementText.trim()) {
      toast({ title: "Pernyataan wajib diisi", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const signatureDataUrl = sigRef.current.getTrimmedCanvas().toDataURL("image/png");

      const { data: letterId, error } = await supabase.rpc("submit_unlock_letter", {
        p_lock_id: lockId,
        p_statement_text: statementText.trim(),
        p_signature_data: signatureDataUrl,
      });

      if (error) throw error;

      toast({ title: "Surat Terkirim", description: "Surat permohonan pembukaan lock berhasil diajukan." });

      // Generate + upload PDF; ini best-effort, kegagalan tidak membatalkan pengajuan
      // yang sudah tersimpan di database.
      try {
        const { data: letterRow } = await supabase
          .from("account_unlock_letters")
          .select("letter_number, employee_signed_at")
          .eq("id", letterId as string)
          .single();

        if (letterRow) {
          const pdfBlob = await generateUnlockLetterPDF(
            {
              letter_number: letterRow.letter_number,
              employee_name: profile?.full_name || "-",
              nik: profile?.nik || "-",
              jabatan: profile?.jabatan || "-",
              departemen: profile?.departemen || "-",
              statement_text: statementText.trim(),
              employee_signature_data: signatureDataUrl,
              employee_signed_at: letterRow.employee_signed_at,
            },
            logo
          );

          const documentPath = await uploadUnlockLetterPdf(pdfBlob, user!.id, letterId as string);

          await supabase.rpc("set_unlock_letter_document", {
            p_letter_id: letterId as string,
            p_document_url: documentPath,
          });
        }
      } catch (pdfError) {
        logger.error("Failed to generate/upload unlock letter PDF:", pdfError);
      }

      setStatementText(DEFAULT_STATEMENT);
      handleClearSignature();
      onOpenChange(false);
      onSubmitted();
    } catch (error) {
      toast({
        title: "Gagal Mengirim",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !isSubmitting && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-primary" />
            Surat Permohonan Pembukaan Lock
          </DialogTitle>
          <DialogDescription>
            Baca dan lengkapi pernyataan di bawah ini, lalu bubuhkan tanda tangan digital Anda.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Pernyataan</Label>
            <Textarea
              value={statementText}
              onChange={(e) => setStatementText(e.target.value)}
              rows={5}
              disabled={isSubmitting}
              maxLength={2000}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Tanda Tangan</Label>
              <Button variant="ghost" size="sm" onClick={handleClearSignature} disabled={isSubmitting}>
                <Eraser className="h-3.5 w-3.5 mr-1" />
                Hapus
              </Button>
            </div>
            <div className="border border-border rounded-lg bg-white overflow-hidden">
              <SignatureCanvas
                ref={sigRef}
                penColor="black"
                canvasProps={{ className: "w-full h-40 touch-none" }}
                onEnd={() => setIsEmpty(!!sigRef.current?.isEmpty())}
              />
            </div>
            <p className="text-xs text-muted-foreground">Gambar tanda tangan Anda menggunakan jari atau mouse.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || isEmpty || !statementText.trim()}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Kirim Pengajuan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UnlockLetterDialog;
