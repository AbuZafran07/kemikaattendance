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

interface AdminCreateBusinessTravelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

const AdminCreateBusinessTravelDialog = ({ open, onOpenChange, onCreated }: AdminCreateBusinessTravelDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<{ id: string; full_name: string; nik: string }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [destination, setDestination] = useState("");
  const [purpose, setPurpose] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [caFile, setCaFile] = useState<File | null>(null);
  const [caNumber, setCaNumber] = useState("");


  useEffect(() => {
    if (open) {
      fetchEmployees();
      resetForm();
    }
  }, [open]);

  const resetForm = () => {
    setSelectedUserId("");
    setDestination("");
    setPurpose("");
    setStartDate("");
    setEndDate("");
    setNotes("");
    setCaFile(null);
    setCaNumber("");
  };

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, nik")
      .order("full_name");
    if (data) setEmployees(data);
  };

  const handleSubmit = async () => {
    if (!selectedUserId || !destination.trim() || !purpose.trim() || !startDate || !endDate) {
      toast({ title: "Lengkapi semua field wajib", variant: "destructive" });
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
      const { data, error } = await supabase.from("business_travel_requests").insert({
        user_id: selectedUserId,
        destination: destination.trim(),
        purpose: purpose.trim(),
        start_date: startDate,
        end_date: endDate,
        total_days: totalDays,
        notes: notes.trim() || null,
        status: "approved" as any,
        approved_by: currentUser?.id,
        approved_at: new Date().toISOString(),
        ca_number: caNumber.trim() || null,
      } as any).select("id").single();

      if (error) throw error;

      // Upload dokumen CA (Cash Advance) — syarat tunjangan dinas
      if (caFile && data?.id) {
        const ext = caFile.name.split(".").pop();
        const path = `${selectedUserId}/ca_${data.id}_${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("business-travel-docs")
          .upload(path, caFile);
        if (upErr) {
          toast({ title: "Dokumen CA gagal diupload", description: upErr.message, variant: "destructive" });
        } else {
          await supabase
            .from("business_travel_requests")
            .update({ ca_document_url: path, ca_uploaded_at: new Date().toISOString() } as any)
            .eq("id", data.id);
        }
      }


      if (currentUser && data) {
        await logApprovalAction({
          request_type: "business_travel",
          request_id: data.id,
          action_type: "created_by_admin",
          performed_by: currentUser.id,
          target_user_id: selectedUserId,
          notes: "Dibuat langsung oleh Admin",
          details: { destination: destination.trim(), start_date: startDate, end_date: endDate, total_days: totalDays },
        });
      }

      // Auto-inject travel allowance to payroll_overrides (admin-create is auto-approved)
      let travelNote = "";
      try {
        const { applyBusinessTravelAllowance } = await import("@/lib/businessTravelAllowance");
        const res = await applyBusinessTravelAllowance({
          userId: selectedUserId,
          startDate,
          endDate,
          requestId: data?.id,
        });
        if (!res.ok && res.reason) {
          toast({ title: "Tunjangan dinas tidak diproses", description: res.reason, variant: "destructive" });
        } else if (res.ok && res.amount > 0) {
          const monthName = new Date(res.period_year, res.period_month - 1, 1).toLocaleString("id-ID", { month: "long" });
          const fmt = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(res.amount);
          travelNote = ` Tunj. dinas ${fmt} → payroll ${monthName} ${res.period_year}.`;
        }
      } catch (err) {
        console.error("applyBusinessTravelAllowance failed:", err);
      }

      toast({ title: "Berhasil", description: `Perjalanan dinas karyawan berhasil dibuat.${travelNote}` });
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
          <DialogTitle>Buat Perjalanan Dinas</DialogTitle>
          <DialogDescription>Admin membuat perjalanan dinas langsung untuk karyawan (otomatis disetujui)</DialogDescription>
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
            <Label>Tujuan</Label>
            <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Kota/lokasi tujuan" />
          </div>
          <div>
            <Label>Keperluan</Label>
            <Textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Tujuan perjalanan dinas..." />
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
            <Label>Catatan (opsional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Catatan tambahan..." />
          </div>
          <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3">
            <div>
              <Label>Nomor CA (Cash Advance) — opsional</Label>
              <Input value={caNumber} onChange={(e) => setCaNumber(e.target.value)} placeholder="Contoh: CA/2026/09/001" />
            </div>
            <div>
              <Label>Dokumen CA (Cash Advance)</Label>
              <Input
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  if (f && f.size > 10 * 1024 * 1024) {
                    toast({ title: "Ukuran file terlalu besar", description: "Maksimal 10 MB.", variant: "destructive" });
                    e.target.value = "";
                    return;
                  }
                  setCaFile(f);
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Tanpa dokumen CA, tunjangan perjalanan dinas tidak akan diproses.
            </p>
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

export default AdminCreateBusinessTravelDialog;
