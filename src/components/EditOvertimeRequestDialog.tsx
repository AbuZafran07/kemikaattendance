import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface OvertimeRequest {
  id: string;
  overtime_date: string;
  hours: number;
  reason: string;
  status: string;
}

interface EditOvertimeRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: OvertimeRequest;
  onUpdated: () => void;
}

export const EditOvertimeRequestDialog = ({
  open,
  onOpenChange,
  request,
  onUpdated,
}: EditOvertimeRequestDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [overtimeDate, setOvertimeDate] = useState(request.overtime_date);
  const [hours, setHours] = useState(request.hours.toString());
  const [reason, setReason] = useState(request.reason);

  const handleSubmit = async () => {
    if (!overtimeDate || !hours || !reason.trim()) {
      toast.error("Harap lengkapi semua field");
      return;
    }

    const hoursNum = parseInt(hours);
    if (isNaN(hoursNum) || hoursNum <= 0) {
      toast.error("Jam lembur harus lebih dari 0");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("overtime_requests")
        .update({
          overtime_date: overtimeDate,
          hours: hoursNum,
          reason: reason.trim(),
        })
        .eq("id", request.id);

      if (error) throw error;

      toast.success("Pengajuan lembur berhasil diperbarui");
      onUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating overtime request:", error);
      toast.error("Gagal memperbarui pengajuan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Pengajuan Lembur</DialogTitle>
          <DialogDescription>
            Ubah detail pengajuan lembur Anda.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="overtime-date">Tanggal Lembur</Label>
            <Input
              id="overtime-date"
              type="date"
              value={overtimeDate}
              onChange={(e) => setOvertimeDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hours">Jam Lembur</Label>
            <Input
              id="hours"
              type="number"
              min="1"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="Jumlah jam lembur"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Alasan</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Masukkan alasan lembur..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};