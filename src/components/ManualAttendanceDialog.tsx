import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, UserPlus, X, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { isAttendanceExempt } from "@/lib/employeeFilters";

interface Employee {
  id: string;
  full_name: string;
  departemen: string;
  photo_url: string | null;
}

interface OfficeLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
}

interface ManualAttendanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const ManualAttendanceDialog = ({ open, onOpenChange, onSuccess }: ManualAttendanceDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<Employee[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [officeLocations, setOfficeLocations] = useState<OfficeLocation[]>([]);

  const [attendanceDate, setAttendanceDate] = useState("");
  const [checkInTime, setCheckInTime] = useState("08:00");
  const [checkOutTime, setCheckOutTime] = useState("17:00");
  const [statusMode, setStatusMode] = useState<"auto" | "manual">("auto");
  const [manualStatus, setManualStatus] = useState<"hadir" | "terlambat" | "pulang_cepat">("hadir");
  const [selectedOffice, setSelectedOffice] = useState<string>("none");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      fetchEmployees();
      fetchOfficeLocations();
      setAttendanceDate(new Date().toISOString().split("T")[0]);
      setSelectedEmployees([]);
      setCheckInTime("08:00");
      setCheckOutTime("17:00");
      setStatusMode("auto");
      setManualStatus("hadir");
      setSelectedOffice("none");
      setNotes("");
      setEmployeeSearch("");
    }
  }, [open]);

  const fetchEmployees = async () => {
    // Fetch non-admin employees
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    const adminIds = new Set((adminRoles || []).map(r => r.user_id));

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, departemen, photo_url")
      .eq("status", "Active")
      .order("full_name");

    if (profiles) {
      setEmployees(profiles.filter(p => !adminIds.has(p.id)));
    }
  };

  const fetchOfficeLocations = async () => {
    const { data } = await supabase.rpc("get_office_locations");
    if (data) {
      setOfficeLocations(data as unknown as OfficeLocation[]);
    }
  };

  const toggleEmployee = (emp: Employee) => {
    setSelectedEmployees(prev => {
      const exists = prev.find(e => e.id === emp.id);
      if (exists) return prev.filter(e => e.id !== emp.id);
      return [...prev, emp];
    });
  };

  const selectAll = () => {
    setSelectedEmployees(filteredEmployees);
  };

  const clearAll = () => {
    setSelectedEmployees([]);
  };

  const filteredEmployees = employees.filter(emp => {
    if (!employeeSearch.trim()) return true;
    const q = employeeSearch.toLowerCase();
    return emp.full_name.toLowerCase().includes(q) || emp.departemen.toLowerCase().includes(q);
  });

  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  // Determine status based on work hours config
  const calculateStatus = async (checkIn: Date, checkOut: Date | null): Promise<"hadir" | "terlambat" | "pulang_cepat"> => {
    try {
      // Check special work hours
      const { data: specialSettings } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "special_work_hours")
        .maybeSingle();

      let workHours: { check_in_end: string; check_out_start: string; late_tolerance_minutes: number; early_leave_tolerance_minutes: number } | null = null;

      if (specialSettings?.value) {
        const config = specialSettings.value as any;
        const periods = config.periods || [];
        const dateStr = checkIn.toISOString().split("T")[0];
        for (const period of periods) {
          if (period.is_active && dateStr >= period.start_date && dateStr <= period.end_date) {
            workHours = {
              check_in_end: period.check_in_end,
              check_out_start: period.check_out_start,
              late_tolerance_minutes: period.late_tolerance_minutes || 0,
              early_leave_tolerance_minutes: period.early_leave_tolerance_minutes || 0,
            };
            break;
          }
        }
      }

      if (!workHours) {
        const { data: normalSettings } = await supabase
          .from("system_settings")
          .select("value")
          .eq("key", "work_hours")
          .maybeSingle();

        if (normalSettings?.value) {
          const config = normalSettings.value as any;
          const dow = checkIn.getDay();
          if (dow === 5 && config.friday_enabled) {
            workHours = {
              check_in_end: config.check_in_end,
              check_out_start: config.friday_check_out_start || config.check_out_start,
              late_tolerance_minutes: config.late_tolerance_minutes || 0,
              early_leave_tolerance_minutes: config.friday_early_leave_tolerance_minutes ?? config.early_leave_tolerance_minutes ?? 0,
            };
          } else {
            workHours = {
              check_in_end: config.check_in_end,
              check_out_start: config.check_out_start,
              late_tolerance_minutes: config.late_tolerance_minutes || 0,
              early_leave_tolerance_minutes: config.early_leave_tolerance_minutes || 0,
            };
          }
        }
      }

      if (!workHours) return "hadir";

      const [lateH, lateM] = workHours.check_in_end.split(":").map(Number);
      const lateDeadline = new Date(checkIn);
      lateDeadline.setHours(lateH, lateM + (workHours.late_tolerance_minutes || 0), 0, 0);
      if (checkIn > lateDeadline) return "terlambat";

      if (checkOut) {
        const [earlyH, earlyM] = workHours.check_out_start.split(":").map(Number);
        const earlyThreshold = new Date(checkOut);
        earlyThreshold.setHours(earlyH, earlyM - (workHours.early_leave_tolerance_minutes || 0), 0, 0);
        if (checkOut < earlyThreshold) return "pulang_cepat";
      }

      return "hadir";
    } catch {
      return "hadir";
    }
  };

  const handleSubmit = async () => {
    if (selectedEmployees.length === 0) {
      toast({ title: "Error", description: "Pilih minimal 1 karyawan", variant: "destructive" });
      return;
    }
    if (!attendanceDate) {
      toast({ title: "Error", description: "Tanggal harus diisi", variant: "destructive" });
      return;
    }
    if (!checkInTime) {
      toast({ title: "Error", description: "Jam check-in harus diisi", variant: "destructive" });
      return;
    }
    if (!notes.trim()) {
      toast({ title: "Error", description: "Catatan/alasan wajib diisi", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const checkInDateTime = new Date(`${attendanceDate}T${checkInTime}:00`);
      const checkOutDateTime = checkOutTime ? new Date(`${attendanceDate}T${checkOutTime}:00`) : null;

      // Handle overnight shift
      if (checkOutDateTime && checkOutDateTime <= checkInDateTime) {
        checkOutDateTime.setDate(checkOutDateTime.getDate() + 1);
      }

      let durationMinutes: number | null = null;
      if (checkOutDateTime) {
        durationMinutes = Math.round((checkOutDateTime.getTime() - checkInDateTime.getTime()) / 60000);
      }

      let status: "hadir" | "terlambat" | "pulang_cepat";
      if (statusMode === "manual") {
        status = manualStatus;
      } else {
        status = await calculateStatus(checkInDateTime, checkOutDateTime);
      }

      // Get office coordinates
      let latitude = 0;
      let longitude = 0;
      let gpsValidated = false;

      if (selectedOffice !== "none") {
        const office = officeLocations.find(o => o.id === selectedOffice);
        if (office) {
          latitude = office.latitude;
          longitude = office.longitude;
          gpsValidated = true;
        }
      }

      // Check for existing attendance records on the same date for selected employees
      const startOfDay = new Date(attendanceDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(attendanceDate);
      endOfDay.setHours(23, 59, 59, 999);

      const { data: existingRecords } = await supabase
        .from("attendance")
        .select("user_id")
        .in("user_id", selectedEmployees.map(e => e.id))
        .gte("check_in_time", startOfDay.toISOString())
        .lte("check_in_time", endOfDay.toISOString());

      const existingUserIds = new Set((existingRecords || []).map(r => r.user_id));
      const newEmployees = selectedEmployees.filter(e => !existingUserIds.has(e.id));
      const skippedCount = selectedEmployees.length - newEmployees.length;

      if (newEmployees.length === 0) {
        toast({ title: "Info", description: "Semua karyawan yang dipilih sudah memiliki absensi pada tanggal tersebut" });
        setIsSaving(false);
        return;
      }

      // Insert attendance records
      const records = newEmployees.map(emp => ({
        user_id: emp.id,
        check_in_time: checkInDateTime.toISOString(),
        check_out_time: checkOutDateTime?.toISOString() || null,
        check_in_latitude: latitude,
        check_in_longitude: longitude,
        check_out_latitude: checkOutDateTime ? latitude : null,
        check_out_longitude: checkOutDateTime ? longitude : null,
        gps_validated: gpsValidated,
        status,
        duration_minutes: durationMinutes,
        notes: `[Input Manual] ${notes.trim()}`,
      }));

      const { data: insertedRecords, error } = await supabase
        .from("attendance")
        .insert(records)
        .select("id, user_id");

      if (error) throw error;

      // Insert audit logs
      if (insertedRecords) {
        const auditLogs = insertedRecords.map(rec => ({
          attendance_id: rec.id,
          action_type: "manual_input",
          changed_by: user!.id,
          old_data: {},
          new_data: {
            check_in_time: checkInDateTime.toISOString(),
            check_out_time: checkOutDateTime?.toISOString() || null,
            status,
          },
          reason: `Input manual oleh admin: ${notes.trim()}`,
        }));

        await supabase.from("attendance_audit_logs").insert(auditLogs);
      }

      let message = `${newEmployees.length} absensi berhasil ditambahkan`;
      if (skippedCount > 0) {
        message += `. ${skippedCount} karyawan dilewati (sudah ada absensi)`;
      }

      toast({ title: "Berhasil", description: message });
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Gagal menambahkan absensi", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Input Absensi Manual
          </DialogTitle>
          <DialogDescription>
            Tambahkan data absensi secara manual untuk karyawan terpilih
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Employee Selection */}
          <div className="space-y-2">
            <Label>Pilih Karyawan <span className="text-destructive">*</span></Label>
            {selectedEmployees.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedEmployees.map(emp => (
                  <Badge key={emp.id} variant="secondary" className="gap-1 pr-1">
                    {emp.full_name}
                    <button onClick={() => toggleEmployee(emp)} className="ml-1 hover:bg-muted rounded-full p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama atau departemen..."
                value={employeeSearch}
                onChange={e => setEmployeeSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{selectedEmployees.length} karyawan dipilih</span>
              <div className="flex gap-2">
                <button onClick={selectAll} className="hover:underline text-primary">Pilih Semua</button>
                <button onClick={clearAll} className="hover:underline text-destructive">Hapus Semua</button>
              </div>
            </div>
            <ScrollArea className="h-40 border rounded-md">
              <div className="p-2 space-y-1">
                {filteredEmployees.map(emp => (
                  <label
                    key={emp.id}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedEmployees.some(e => e.id === emp.id)}
                      onCheckedChange={() => toggleEmployee(emp)}
                    />
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={emp.photo_url || undefined} />
                      <AvatarFallback className="text-[10px]">{getInitials(emp.full_name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{emp.full_name}</p>
                      <p className="text-xs text-muted-foreground">{emp.departemen}</p>
                    </div>
                  </label>
                ))}
                {filteredEmployees.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Tidak ada karyawan ditemukan</p>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Tanggal <span className="text-destructive">*</span></Label>
              <Input type="date" value={attendanceDate} onChange={e => setAttendanceDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Jam Check-In <span className="text-destructive">*</span></Label>
              <Input type="time" value={checkInTime} onChange={e => setCheckInTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Jam Check-Out</Label>
              <Input type="time" value={checkOutTime} onChange={e => setCheckOutTime(e.target.value)} />
            </div>
          </div>

          {/* Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status Absensi</Label>
              <Select value={statusMode} onValueChange={(v: "auto" | "manual") => setStatusMode(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Otomatis (dari jam kerja)</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {statusMode === "manual" && (
              <div className="space-y-2">
                <Label>Pilih Status</Label>
                <Select value={manualStatus} onValueChange={(v: "hadir" | "terlambat" | "pulang_cepat") => setManualStatus(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hadir">Hadir</SelectItem>
                    <SelectItem value="terlambat">Terlambat</SelectItem>
                    <SelectItem value="pulang_cepat">Pulang Cepat</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Office Location */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              Lokasi Kantor (opsional)
            </Label>
            <Select value={selectedOffice} onValueChange={setSelectedOffice}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih lokasi kantor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Tidak ada lokasi</SelectItem>
                {officeLocations.map(office => (
                  <SelectItem key={office.id} value={office.id}>{office.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Catatan / Alasan <span className="text-destructive">*</span></Label>
            <Textarea
              placeholder="Contoh: Input manual karena karyawan lupa absen / mesin absen error"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground">{notes.length}/1000 karakter</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving || selectedEmployees.length === 0 || !notes.trim()}>
            {isSaving ? "Menyimpan..." : `Simpan (${selectedEmployees.length} karyawan)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ManualAttendanceDialog;
