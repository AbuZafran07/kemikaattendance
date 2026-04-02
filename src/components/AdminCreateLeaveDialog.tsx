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
import { differenceInCalendarDays } from "date-fns";
import { logApprovalAction } from "@/lib/approvalAuditLog";

interface AdminCreateLeaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

const AdminCreateLeaveDialog = ({ open, onOpenChange, onCreated }: AdminCreateLeaveDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<{ id: string; full_name: string; nik: string }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [leaveType, setLeaveType] = useState("cuti_tahunan");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) {
      fetchEmployees();
      resetForm();
    }
  }, [open]);

  const resetForm = () => {
    setSelectedUserId("");
    setLeaveType("cuti_tahunan");
    setStartDate("");
    setEndDate("");
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
    if (!selectedUserId || !startDate || !endDate || !reason.trim()) {
      toast({ title: "Lengkapi semua field", variant: "destructive" });
      return;
    }

    const totalDays = differenceInCalendarDays(new Date(endDate), new Date(startDate)) + 1;
    if (totalDays <= 0) {
      toast({ title: "Tanggal tidak valid", description: "Tanggal selesai harus setelah tanggal mulai", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const currentUser = (await supabase.auth.getUser()).data.user;
      const { data, error } = await supabase.from("leave_requests").insert({
        user_id: selectedUserId,
        leave_type: leaveType as any,
        start_date: startDate,
        end_date: endDate,
        total_days: totalDays,
        reason: reason.trim(),
        status: "approved" as any,
        approved_by: currentUser?.id,
        approved_at: new Date().toISOString(),
        approval_notes: "Dibuat langsung oleh Admin",
      }).select("id").single();

      if (error) throw error;

      if (currentUser && data) {
        await logApprovalAction({
          request_type: "leave",
          request_id: data.id,
          action_type: "created_by_admin",
          performed_by: currentUser.id,
          target_user_id: selectedUserId,
          notes: "Dibuat langsung oleh Admin",
          details: { leave_type: leaveType, start_date: startDate, end_date: endDate, total_days: totalDays },
        });
      }

      toast({ title: "Berhasil", description: "Cuti karyawan berhasil dibuat" });
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
          <DialogTitle>Buat Cuti Karyawan</DialogTitle>
          <DialogDescription>Admin membuat pengajuan cuti langsung untuk karyawan (otomatis disetujui)</DialogDescription>
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
          <div>
            <Label>Jenis Cuti</Label>
            <Select value={leaveType} onValueChange={setLeaveType}>
              <SelectTrigger>
                <SelectValue />
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
            <div>
              <Label>Tanggal Mulai</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label>Tanggal Selesai</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Alasan</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Alasan cuti..." />
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

export default AdminCreateLeaveDialog;
