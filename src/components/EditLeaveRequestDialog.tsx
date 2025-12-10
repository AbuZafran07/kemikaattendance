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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { differenceInDays, parseISO } from "date-fns";

interface LeaveRequest {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  status: string;
}

interface EditLeaveRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: LeaveRequest;
  onUpdated: () => void;
}

export const EditLeaveRequestDialog = ({
  open,
  onOpenChange,
  request,
  onUpdated,
}: EditLeaveRequestDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [leaveType, setLeaveType] = useState(request.leave_type);
  const [startDate, setStartDate] = useState(request.start_date);
  const [endDate, setEndDate] = useState(request.end_date);
  const [reason, setReason] = useState(request.reason);

  const calculateTotalDays = (start: string, end: string) => {
    if (!start || !end) return 0;
    return differenceInDays(parseISO(end), parseISO(start)) + 1;
  };

  const handleSubmit = async () => {
    if (!leaveType || !startDate || !endDate || !reason.trim()) {
      toast.error("Harap lengkapi semua field");
      return;
    }

    const totalDays = calculateTotalDays(startDate, endDate);
    if (totalDays <= 0) {
      toast.error("Tanggal selesai harus setelah tanggal mulai");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("leave_requests")
        .update({
          leave_type: leaveType as "cuti_tahunan" | "izin" | "sakit" | "lupa_absen",
          start_date: startDate,
          end_date: endDate,
          total_days: totalDays,
          reason: reason.trim(),
        })
        .eq("id", request.id);

      if (error) throw error;

      toast.success("Pengajuan cuti berhasil diperbarui");
      onUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating leave request:", error);
      toast.error("Gagal memperbarui pengajuan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Pengajuan Cuti</DialogTitle>
          <DialogDescription>
            Ubah detail pengajuan cuti Anda.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="leave-type">Jenis Cuti</Label>
            <Select value={leaveType} onValueChange={setLeaveType}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih jenis cuti" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cuti_tahunan">Cuti Tahunan</SelectItem>
                <SelectItem value="izin">Izin</SelectItem>
                <SelectItem value="sakit">Sakit</SelectItem>
                <SelectItem value="lupa_absen">Lupa Absen</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Tanggal Mulai</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">Tanggal Selesai</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {startDate && endDate && (
            <p className="text-sm text-muted-foreground">
              Total: {calculateTotalDays(startDate, endDate)} hari
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="reason">Alasan</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Masukkan alasan pengajuan..."
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