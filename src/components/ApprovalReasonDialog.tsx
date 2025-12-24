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
import { useState } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface ApprovalReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: "approve" | "reject";
  onConfirm: (reason: string) => Promise<void>;
  title?: string;
}

const ApprovalReasonDialog = ({
  open,
  onOpenChange,
  action,
  onConfirm,
  title = "Permintaan",
}: ApprovalReasonDialogProps) => {
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const isApprove = action === "approve";

  const handleConfirm = async () => {
    if (!reason.trim()) return;
    
    setIsLoading(true);
    try {
      await onConfirm(reason.trim());
      setReason("");
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setReason("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isApprove ? (
              <CheckCircle2 className="h-5 w-5 text-primary" />
            ) : (
              <XCircle className="h-5 w-5 text-destructive" />
            )}
            {isApprove ? "Setujui" : "Tolak"} {title}
          </DialogTitle>
          <DialogDescription>
            {isApprove
              ? `Berikan keterangan mengapa ${title.toLowerCase()} ini disetujui.`
              : `Berikan alasan mengapa ${title.toLowerCase()} ini ditolak.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">
              {isApprove ? "Keterangan Persetujuan" : "Alasan Penolakan"} *
            </Label>
            <Textarea
              id="reason"
              placeholder={
                isApprove
                  ? "Contoh: Disetujui sesuai kebijakan perusahaan..."
                  : "Contoh: Ditolak karena kuota cuti habis..."
              }
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              disabled={isLoading}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Batal
          </Button>
          <Button
            variant={isApprove ? "default" : "destructive"}
            onClick={handleConfirm}
            disabled={!reason.trim() || isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isApprove ? "Setujui" : "Tolak"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ApprovalReasonDialog;
