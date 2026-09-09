import { useState, useEffect, useMemo } from "react";
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
import { getSpecialLeaveEndDate } from "@/lib/specialLeaveDates";
import { useOvertimePolicy } from "@/hooks/usePolicySettings";

interface AdminCreateLeaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

interface EmployeeRow {
  id: string;
  full_name: string;
  nik: string;
  departemen: string;
  jabatan: string;
}

interface SpecialLeaveType {
  id: string;
  code: string;
  name: string;
  default_duration_days: number;
  requires_document: boolean;
}


const AdminCreateLeaveDialog = ({ open, onOpenChange, onCreated }: AdminCreateLeaveDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [leaveType, setLeaveType] = useState("cuti_tahunan");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [delegatedTo, setDelegatedTo] = useState("");
  const [delegationNotes, setDelegationNotes] = useState("");
  const [specialLeaveTypes, setSpecialLeaveTypes] = useState<SpecialLeaveType[]>([]);
  const [specialLeaveTypeId, setSpecialLeaveTypeId] = useState("");

  useEffect(() => {
    if (open) {
      fetchEmployees();
      fetchSpecialLeaveTypes();
      resetForm();
    }
  }, [open]);

  const resetForm = () => {
    setSelectedUserId("");
    setLeaveType("cuti_tahunan");
    setStartDate("");
    setEndDate("");
    setReason("");
    setDelegatedTo("");
    setDelegationNotes("");
    setSpecialLeaveTypeId("");
  };

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, nik, departemen, jabatan")
      .eq("status", "Active")
      .order("full_name");
    if (data) setEmployees(data);
  };

  const fetchSpecialLeaveTypes = async () => {
    const { data } = await supabase
      .from("special_leave_types")
      .select("id, code, name, default_duration_days, requires_document")
      .eq("is_active", true)
      .order("display_order");
    if (data) setSpecialLeaveTypes(data);
  };

  const selectedSpecialType = useMemo(
    () => specialLeaveTypes.find((t) => t.id === specialLeaveTypeId),
    [specialLeaveTypes, specialLeaveTypeId]
  );

  // Izin khusus: durasi tetap per jenis, tanggal selesai otomatis
  useEffect(() => {
    if (leaveType !== "izin_khusus" || !selectedSpecialType || !startDate) return;
    const start = new Date(startDate);
    if (isNaN(start.getTime())) return;
    start.setDate(start.getDate() + selectedSpecialType.default_duration_days - 1);
    setEndDate(start.toISOString().split("T")[0]);
  }, [leaveType, selectedSpecialType, startDate]);

  useEffect(() => {
    if (leaveType !== "izin_khusus") setSpecialLeaveTypeId("");
  }, [leaveType]);


  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === selectedUserId),
    [employees, selectedUserId]
  );

  // Reset delegation when employee changes (department might differ)
  useEffect(() => {
    setDelegatedTo("");
  }, [selectedUserId]);

  const colleagues = useMemo(() => {
    if (!selectedEmployee) return [];
    return employees.filter(
      (e) => e.departemen === selectedEmployee.departemen && e.id !== selectedEmployee.id
    );
  }, [employees, selectedEmployee]);

  const handleSubmit = async () => {
    if (!selectedUserId || !startDate || !endDate || !reason.trim()) {
      toast({ title: "Lengkapi semua field", variant: "destructive" });
      return;
    }
    if (!delegatedTo || !delegationNotes.trim()) {
      toast({ title: "Pendelegasian tugas wajib diisi", description: "Pilih karyawan pengganti dan tuliskan detail tugas", variant: "destructive" });
      return;
    }

    if (leaveType === "izin_khusus" && !selectedSpecialType) {
      toast({ title: "Jenis izin khusus harus dipilih", variant: "destructive" });
      return;
    }

    const totalDays = leaveType === "izin_khusus" && selectedSpecialType
      ? selectedSpecialType.default_duration_days
      : differenceInCalendarDays(new Date(endDate), new Date(startDate)) + 1;
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
        delegated_to: delegatedTo,
        delegation_notes: delegationNotes.trim(),
        special_leave_type_id: leaveType === "izin_khusus" ? specialLeaveTypeId : null,
      } as any).select("id").single();

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
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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
                <SelectItem value="izin_khusus">Izin Khusus</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {leaveType === "izin_khusus" && (
            <div>
              <Label>Jenis Izin Khusus</Label>
              <Select value={specialLeaveTypeId} onValueChange={setSpecialLeaveTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih jenis izin khusus" />
                </SelectTrigger>
                <SelectContent>
                  {specialLeaveTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.default_duration_days} hari)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedSpecialType && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Jatah tetap {selectedSpecialType.default_duration_days} hari kalender, tanggal selesai terisi otomatis.
                </p>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tanggal Mulai</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label>Tanggal Selesai</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={leaveType === "izin_khusus"}
              />
            </div>
          </div>
          <div>
            <Label>Alasan</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Alasan cuti..." />
          </div>

          <div className="border-t pt-4 space-y-3">
            <div>
              <p className="text-sm font-semibold">Pendelegasian Tugas</p>
              <p className="text-xs text-muted-foreground">
                {selectedEmployee
                  ? <>Pilih rekan dari departemen <strong>{selectedEmployee.departemen}</strong> yang akan menggantikan tugas.</>
                  : "Pilih karyawan terlebih dahulu untuk melihat daftar rekan satu departemen."}
              </p>
            </div>
            <div>
              <Label>Karyawan Pengganti</Label>
              <Select value={delegatedTo} onValueChange={setDelegatedTo} disabled={!selectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder={
                    !selectedEmployee
                      ? "Pilih karyawan dulu"
                      : colleagues.length === 0
                        ? "Tidak ada rekan di departemen ini"
                        : "Pilih karyawan pengganti"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {colleagues.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.full_name} - {c.jabatan}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Detail Tugas yang Didelegasikan</Label>
              <Textarea
                value={delegationNotes}
                onChange={(e) => setDelegationNotes(e.target.value)}
                placeholder="Tuliskan tugas-tugas yang didelegasikan..."
                rows={3}
              />
            </div>
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
