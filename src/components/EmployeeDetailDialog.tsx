import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  User, Mail, Phone, MapPin, Calendar, Briefcase, Building2,
  Pencil, Wallet, CreditCard, Laptop, Shield, Clock, DollarSign, FileText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatAttendanceStatus } from "@/lib/statusUtils";
import { cn } from "@/lib/utils";
import { getFixedAllowanceComponents, DEFAULT_FIXED_ALLOWANCE_COMPONENTS, type FixedAllowanceComponents } from "@/lib/bpjsFixedComponents";
import { EmployeeDocuments } from "@/components/EmployeeDocuments";
import { ContractHistory } from "@/components/ContractHistory";

interface EmployeeDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: any;
  employeeRoles: Record<string, string>;
  onEdit: (employee: any) => void;
}

const getInitials = (name: string) =>
  name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

const formatRupiah = (value: number) =>
  `Rp ${Number(value || 0).toLocaleString("id-ID")}`;

export const EmployeeDetailDialog = ({
  open,
  onOpenChange,
  employee,
  employeeRoles,
  onEdit,
}: EmployeeDetailDialogProps) => {
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [payrollHistory, setPayrollHistory] = useState<any[]>([]);
  const [salaryHistory, setSalaryHistory] = useState<any[]>([]);
  const [salaryChangerNames, setSalaryChangerNames] = useState<Record<string, string>>({});
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [loadingPayroll, setLoadingPayroll] = useState(false);
  const [loadingSalary, setLoadingSalary] = useState(false);
  const [facFlags, setFacFlags] = useState<FixedAllowanceComponents>(DEFAULT_FIXED_ALLOWANCE_COMPONENTS);

  useEffect(() => {
    getFixedAllowanceComponents().then(setFacFlags).catch(() => {});
  }, [open]);

  useEffect(() => {
    if (open && employee) {
      fetchAttendanceHistory();
      fetchPayrollHistory();
      fetchSalaryHistory();
    }
  }, [open, employee?.id]);

  const fetchAttendanceHistory = async () => {
    if (!employee) return;
    setLoadingAttendance(true);
    const { data } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", employee.id)
      .order("check_in_time", { ascending: false })
      .limit(20);
    setAttendanceHistory(data || []);
    setLoadingAttendance(false);
  };

  const fetchPayrollHistory = async () => {
    if (!employee) return;
    setLoadingPayroll(true);
    const { data: payrolls } = await supabase
      .from("payroll")
      .select("*")
      .eq("user_id", employee.id)
      .order("created_at", { ascending: false })
      .limit(12);

    if (payrolls && payrolls.length > 0) {
      const periodIds = [...new Set(payrolls.map((p) => p.period_id))];
      const { data: periods } = await supabase
        .from("payroll_periods")
        .select("*")
        .in("id", periodIds);
      const periodMap = new Map((periods || []).map((p) => [p.id, p]));
      setPayrollHistory(
        payrolls.map((p) => ({ ...p, period: periodMap.get(p.period_id) }))
      );
    } else {
      setPayrollHistory([]);
    }
    setLoadingPayroll(false);
  };

  const fetchSalaryHistory = async () => {
    if (!employee) return;
    setLoadingSalary(true);
    const { data } = await supabase
      .from("salary_change_history")
      .select("*")
      .eq("user_id", employee.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setSalaryHistory(data || []);
    const changerIds = [...new Set((data || []).map((r: any) => r.changed_by).filter(Boolean))];
    if (changerIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", changerIds);
      const map: Record<string, string> = {};
      (profs || []).forEach((p: any) => { map[p.id] = p.full_name; });
      setSalaryChangerNames(map);
    }
    setLoadingSalary(false);
  };

  if (!employee) return null;

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detail Karyawan</DialogTitle>
          <DialogDescription>Informasi lengkap karyawan</DialogDescription>
        </DialogHeader>

        {/* Profile Header */}
        <div className="flex flex-col sm:flex-row items-center gap-6 pb-4 border-b border-border">
          <Avatar className="h-20 w-20">
            <AvatarImage src={employee.photo_url} alt={employee.full_name} />
            <AvatarFallback className="text-xl">{getInitials(employee.full_name)}</AvatarFallback>
          </Avatar>
          <div className="text-center sm:text-left">
            <h3 className="text-xl font-bold">{employee.full_name}</h3>
            <p className="text-sm text-muted-foreground">{employee.jabatan}</p>
            <div className="flex items-center gap-2 mt-2 justify-center sm:justify-start flex-wrap">
              <Badge
                variant={
                  employee.status === "Active"
                    ? "default"
                    : employee.status === "Resigned"
                    ? "destructive"
                    : "secondary"
                }
              >
                {employee.status === "Resigned" && employee.resign_date
                  ? `Resigned (${new Date(employee.resign_date).toLocaleDateString("id-ID")})`
                  : employee.status}
              </Badge>
              {employeeRoles[employee.id] === "admin" && <Badge variant="destructive">Admin</Badge>}
              {employee.work_type === "wfa" ? (
                <Badge variant="secondary">Hybrid</Badge>
              ) : (
                <Badge variant="outline">WFO</Badge>
              )}
            </div>
          </div>
        </div>

        <Tabs defaultValue="info" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="info">📋 Info</TabsTrigger>
            <TabsTrigger value="attendance">🕐 Kehadiran</TabsTrigger>
            <TabsTrigger value="payroll">💰 Payroll</TabsTrigger>
            <TabsTrigger value="salary-history">💵 Gaji</TabsTrigger>
            <TabsTrigger value="contract-history">📜 Kontrak</TabsTrigger>
            <TabsTrigger value="documents">📁 Dokumen</TabsTrigger>
          </TabsList>

          {/* INFO TAB */}
          <TabsContent value="info" className="space-y-5 mt-4">
            {/* Informasi Pribadi */}
            <div>
              <p className="text-sm font-semibold text-muted-foreground mb-2">👤 Informasi Pribadi</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <InfoItem icon={User} label="NIK" value={employee.nik} />
                <InfoItem icon={Mail} label="Email" value={employee.email} />
                <InfoItem icon={Phone} label="Telepon" value={employee.phone || "-"} />
                <InfoItem icon={Calendar} label="Tanggal Bergabung" value={new Date(employee.join_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} />
                {employee.status === "Resigned" && employee.resign_date && (
                  <InfoItem
                    icon={Calendar}
                    label="Tanggal Resign"
                    value={new Date(employee.resign_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                  />
                )}
                <div className="sm:col-span-2">
                  <InfoItem icon={MapPin} label="Alamat" value={employee.address || "-"} />
                </div>
                {(employee.notes || (employee.status === "Resigned" && employee.resign_notes)) && (
                  <div className="sm:col-span-2 space-y-2 mt-1">
                    <p className="text-xs font-semibold text-muted-foreground">📝 Catatan</p>
                    <div className="grid grid-cols-1 gap-2">
                      {employee.status === "Resigned" && employee.resign_notes && (
                        <InfoItem icon={FileText} label="Keterangan Resign" value={employee.resign_notes} truncate={false} />
                      )}
                      {employee.notes && (
                        <InfoItem icon={FileText} label="Keterangan Lainnya" value={employee.notes} truncate={false} />
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Informasi Pekerjaan */}
            <div>
              <p className="text-sm font-semibold text-muted-foreground mb-2">💼 Informasi Pekerjaan</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <InfoItem icon={Briefcase} label="Jabatan" value={employee.jabatan} />
                <InfoItem icon={Building2} label="Departemen" value={employee.departemen} />
                <InfoItem icon={Laptop} label="Tipe Kerja" value={employee.work_type === "wfa" ? "Hybrid" : "WFO"} />
                <InfoItem icon={Shield} label="Role" value={(employeeRoles[employee.id] || "employee")} />
              </div>
            </div>

            {/* Payroll Info */}
            <div>
              <p className="text-sm font-semibold text-muted-foreground mb-2">💰 Informasi Payroll</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <InfoItem icon={Wallet} label="Gaji Pokok" value={formatRupiah(employee.basic_salary)} />
                <InfoItem icon={CreditCard} label="Status PTKP" value={employee.ptkp_status || "TK/0"} />
                <InfoItem icon={CreditCard} label="NPWP" value={employee.npwp || "-"} />
                <InfoItem icon={Briefcase} label="Tipe Kontrak" value={employee.contract_type === "contract" ? "Contract Employee" : "Permanent Employee"} />
                <InfoItem icon={FileText} label="Nomor Kontrak" value={employee.contract_number || "-"} />
                <InfoItem icon={Calendar} label="Mulai Kontrak" value={employee.contract_start_date ? new Date(employee.contract_start_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-"} />
                <InfoItem
                  icon={Calendar}
                  label="Berakhir Kontrak"
                  value={(() => {
                    if (employee.contract_type !== "contract") return "Tidak berlaku (Permanent)";
                    if (!employee.contract_end_date) return "-";
                    const end = new Date(employee.contract_end_date + "T00:00:00");
                    const days = Math.ceil((end.getTime() - Date.now()) / 86400000);
                    const dateStr = end.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
                    if (days < 0) return `${dateStr} (⚠️ Berakhir ${Math.abs(days)} hari lalu)`;
                    if (days <= 7) return `${dateStr} (🔴 ${days} hari lagi)`;
                    if (days <= 30) return `${dateStr} (🟡 ${days} hari lagi)`;
                    return `${dateStr} (🟢 ${days} hari lagi)`;
                  })()}
                />
              </div>
            </div>

            {/* Bank Info */}
            <div>
              <p className="text-sm font-semibold text-muted-foreground mb-2">🏦 Informasi Bank</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <InfoItem icon={CreditCard} label="Nama Bank" value={employee.bank_name || "-"} />
                <InfoItem icon={CreditCard} label="No. Rekening" value={employee.bank_account_number || "-"} />
              </div>
            </div>

            {/* Tunjangan */}
            {(() => {
              const items = [
                { key: "jabatan" as const, label: "Jabatan", value: employee.tunjangan_jabatan },
                { key: "operasional" as const, label: "Operasional", value: employee.tunjangan_operasional },
              ];
              const tetap = items.filter(i => facFlags[i.key]);
              const tidakTetap = items.filter(i => !facFlags[i.key]);
              const renderCard = (label: string, value: number) => (
                <InfoItem key={label} icon={Briefcase} label={label} value={formatRupiah(value)} />
              );
              return (
                <>
                  {tetap.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-muted-foreground mb-2">📋 Tunjangan Tetap</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {tetap.map(i => renderCard(i.label, i.value))}
                      </div>
                    </div>
                  )}
                  {tidakTetap.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-muted-foreground mb-2">✨ Tambahan Penghasilan (Tidak Tetap)</p>
                      <p className="text-xs text-muted-foreground mb-2">Tidak dihitung sebagai DPP BPJS.</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {tidakTetap.map(i => renderCard(i.label, i.value))}
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground mb-2">📞 Plafon Tunj. Komunikasi</p>
                    <p className="text-xs text-muted-foreground mb-2">Batas maksimum saat input di Payroll → Tambahan Penghasilan.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <InfoItem icon={Briefcase} label="Batas Maks" value={employee.tunjangan_komunikasi ? formatRupiah(employee.tunjangan_komunikasi) : "Tanpa plafon"} />
                    </div>
                  </div>
                </>
              );

            })()}

            {/* Cuti */}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
              <div className="text-center p-3 rounded-lg bg-primary/5">
                <p className="text-xs text-muted-foreground">Kuota Cuti</p>
                <p className="text-xl font-bold text-primary">{employee.annual_leave_quota || 12}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-primary/5">
                <p className="text-xs text-muted-foreground">Sisa Cuti</p>
                <p className="text-xl font-bold text-primary">{employee.remaining_leave || 12}</p>
              </div>
            </div>
          </TabsContent>

          {/* ATTENDANCE TAB */}
          <TabsContent value="attendance" className="mt-4">
            {loadingAttendance ? (
              <p className="text-center text-muted-foreground py-8">Memuat data kehadiran...</p>
            ) : attendanceHistory.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Belum ada data kehadiran</p>
            ) : (
              <div className="overflow-auto max-h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Check In</TableHead>
                      <TableHead>Check Out</TableHead>
                      <TableHead>Durasi</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendanceHistory.map((att) => (
                      <TableRow key={att.id}>
                        <TableCell className="text-xs">
                          {new Date(att.check_in_time).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                        </TableCell>
                        <TableCell className="text-xs">
                          {new Date(att.check_in_time).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                        </TableCell>
                        <TableCell className="text-xs">
                          {att.check_out_time
                            ? new Date(att.check_out_time).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
                            : "-"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {att.duration_minutes ? `${Math.floor(att.duration_minutes / 60)}j ${att.duration_minutes % 60}m` : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={att.status === "hadir" ? "default" : att.status === "terlambat" ? "destructive" : "secondary"} className="text-xs">
                            {formatAttendanceStatus(att.status)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* PAYROLL TAB */}
          <TabsContent value="payroll" className="mt-4">
            {loadingPayroll ? (
              <p className="text-center text-muted-foreground py-8">Memuat data payroll...</p>
            ) : payrollHistory.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Belum ada data payroll</p>
            ) : (
              <div className="overflow-auto max-h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Periode</TableHead>
                      <TableHead className="text-right">Gaji Pokok</TableHead>
                      <TableHead className="text-right">Tunjangan</TableHead>
                      <TableHead className="text-right">PPh21</TableHead>
                      <TableHead className="text-right">THP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payrollHistory.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-xs font-medium">
                          {p.period ? `${monthNames[(p.period.month || 1) - 1]} ${p.period.year}` : "-"}
                        </TableCell>
                        <TableCell className="text-xs text-right">{formatRupiah(p.basic_salary)}</TableCell>
                        <TableCell className="text-xs text-right">{formatRupiah(p.allowance)}</TableCell>
                        <TableCell className="text-xs text-right text-destructive">{formatRupiah(p.pph21_monthly)}</TableCell>
                        <TableCell className="text-xs text-right font-semibold">{formatRupiah(p.take_home_pay)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* SALARY HISTORY TAB */}
          <TabsContent value="salary-history" className="mt-4">
            {loadingSalary ? (
              <p className="text-center text-muted-foreground py-8">Memuat riwayat gaji...</p>
            ) : salaryHistory.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Belum ada perubahan gaji/tunjangan tercatat.
              </p>
            ) : (
              <div className="space-y-3 max-h-[420px] overflow-y-auto">
                {salaryHistory.map((h) => (
                  <SalaryHistoryItem
                    key={h.id}
                    record={h}
                    changerName={salaryChangerNames[h.changed_by] || "—"}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="contract-history" className="mt-4">
            <ContractHistory employeeId={employee.id} />
          </TabsContent>

          <TabsContent value="documents" className="mt-4">
            <EmployeeDocuments employeeId={employee.id} />
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-3 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button>
          <Button onClick={() => { onOpenChange(false); onEdit(employee); }}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit Data
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const InfoItem = ({ icon: Icon, label, value, truncate = true }: { icon: any; label: string; value: string; truncate?: boolean }) => (
  <div className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/50">
    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
      <Icon className="h-4 w-4 text-primary" />
    </div>
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("font-medium text-sm", truncate ? "truncate capitalize" : "whitespace-pre-wrap break-words")}>{value}</p>
    </div>
  </div>
);

const FIELD_LABELS: Record<string, { label: string; type: 'number' | 'text' | 'bool' }> = {
  basic_salary: { label: 'Gaji Pokok', type: 'number' },
  tunjangan_jabatan: { label: 'Tunjangan Jabatan', type: 'number' },
  tunjangan_komunikasi: { label: 'Batas Maks Tunj. Komunikasi', type: 'number' },
  tunjangan_operasional: { label: 'Tunjangan Operasional', type: 'number' },
  ptkp_status: { label: 'Status PTKP', type: 'text' },
  bpjs_kesehatan_enabled: { label: 'BPJS Kesehatan', type: 'bool' },
  bpjs_ketenagakerjaan_enabled: { label: 'BPJS Ketenagakerjaan', type: 'bool' },
  npwp: { label: 'NPWP', type: 'text' },
  bank_name: { label: 'Nama Bank', type: 'text' },
  bank_account_number: { label: 'No. Rekening', type: 'text' },
};

const formatFieldValue = (key: string, value: any) => {
  const meta = FIELD_LABELS[key];
  if (!meta) return String(value ?? '-');
  if (meta.type === 'number') return `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
  if (meta.type === 'bool') return value ? 'Aktif' : 'Nonaktif';
  return value ? String(value) : '-';
};

const SalaryHistoryItem = ({ record, changerName }: { record: any; changerName: string }) => {
  const changed: string[] = record.changed_fields || [];
  return (
    <div className="rounded-lg border border-border p-3 bg-card">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="text-sm font-semibold flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            Efektif: {new Date(record.effective_date).toLocaleDateString('id-ID', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Diubah oleh <span className="font-medium">{changerName}</span> ·{' '}
            {new Date(record.created_at).toLocaleString('id-ID', {
              day: 'numeric', month: 'short', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </p>
        </div>
        <Badge variant="secondary" className="text-xs">{changed.length} field</Badge>
      </div>

      <div className="rounded-md bg-muted/50 p-2 mb-2">
        <p className="text-xs font-semibold text-muted-foreground mb-0.5">Alasan</p>
        <p className="text-xs whitespace-pre-wrap break-words">{record.reason}</p>
      </div>

      <div className="space-y-1">
        {changed.map((key) => {
          const oldV = record.old_values?.[key];
          const newV = record.new_values?.[key];
          return (
            <div key={key} className="text-xs flex items-center justify-between gap-2 py-0.5">
              <span className="font-medium">{FIELD_LABELS[key]?.label || key}</span>
              <span className="text-muted-foreground text-right">
                <span className="line-through">{formatFieldValue(key, oldV)}</span>
                <span className="mx-1.5 text-foreground">→</span>
                <span className="text-primary font-semibold">{formatFieldValue(key, newV)}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EmployeeDetailDialog;
