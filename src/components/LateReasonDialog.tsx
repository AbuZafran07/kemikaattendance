import { useState } from "react";
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
import { AlertTriangle, Clock } from "lucide-react";

interface LateReasonDialogProps {
  open: boolean;
  type: "terlambat" | "pulang_cepat";
  durationText: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

const LateReasonDialog = ({ open, type, durationText, onConfirm, onCancel }: LateReasonDialogProps) => {
  const [reason, setReason] = useState("");

  const isLate = type === "terlambat";
  const title = isLate ? "Keterangan Terlambat" : "Keterangan Pulang Cepat";
  const description = isLate
    ? "Anda terdeteksi terlambat check-in. Silakan isi alasan keterlambatan Anda."
    : "Anda terdeteksi pulang lebih awal. Silakan isi alasan pulang cepat Anda.";

  const handleConfirm = () => {
    if (reason.trim()) {
      onConfirm(reason.trim());
      setReason("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {title}
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <span>{description}</span>
            <span className="flex items-center gap-1.5 mt-2 font-medium text-foreground">
              <Clock className="h-4 w-4" />
              {durationText}
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Textarea
            placeholder={isLate ? "Contoh: Ban bocor di jalan, macet, dll..." : "Contoh: Anak sakit, ada keperluan keluarga, dll..."}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="min-h-[100px]"
            maxLength={500}
          />
          <p className="text-xs text-muted-foreground text-right">{reason.length}/500</p>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            Batal
          </Button>
          <Button onClick={handleConfirm} disabled={!reason.trim()}>
            Kirim & Lanjutkan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LateReasonDialog;
