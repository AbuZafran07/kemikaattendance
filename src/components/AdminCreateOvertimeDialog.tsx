import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { logApprovalAction } from "@/lib/approvalAuditLog";

interface AdminCreateOvertimeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

const AdminCreateOvertimeDialog = ({ open, onOpenChange, onCreated }: AdminCreateOvertimeDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<{ id: string; full_name: string; nik: string }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [overtimeDate, setOvertimeDate] = useState("");
  const [hours, setHours] = useState("1");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) {
      fetchEmployees();
      resetForm();
    }
  }, [open]);

  const resetForm = () => {
    setSelectedUserId("");
    setOvertimeDate("");
    setHours("1");
    setReason("");
  };

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, nik")
      .order("full_name");
    if (data) setEmployees(data);
  };

  const handleSubmit = async () => {
    if (!selectedUserId || !overtimeDate || !reason.trim()) {
      toast({ title: "Lengkapi semua field", variant: "destructive" });
      return;
    }

    const numHours = parseInt(hours);
    if (isNaN(numHours) || numHours < 1) {
      toast({ title: "Jam lembur tidak valid", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("overtime_requests").insert({
        user_id: selectedUserId,
        overtime_date: overtimeDate,
        hours: numHours,
        reason: reason.trim(),
        status: "approved" as any,
        approved_by: (await supabase.auth.getUser()).data.user?.id,
        approved_at: new Date().toISOString(),
        approval_notes: "Dibuat langsung oleh Admin",
      });

      if (error) throw error;

      toast({ title: "Berhasil", description: "Lembur karyawan berhasil dibuat" });
      onCreated();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Gagal", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Buat Lembur Karyawan</DialogTitle>
          <DialogDescription>Admin membuat pengajuan lembur langsung untuk karyawan (otomatis disetujui)</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Karyawan</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih karyawan" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.nik})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tanggal Lembur</Label>
              <Input type="date" value={overtimeDate} onChange={(e) => setOvertimeDate(e.target.value)} />
            </div>
            <div>
              <Label>Jumlah Jam</Label>
              <Input type="number" min="1" max="12" value={hours} onChange={(e) => setHours(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Alasan</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Alasan lembur..." />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Batal</Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Buat & Setujui
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminCreateOvertimeDialog;
