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
  Pencil, Wallet, CreditCard, Laptop, Shield, Clock, DollarSign,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatAttendanceStatus } from "@/lib/statusUtils";

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
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [loadingPayroll, setLoadingPayroll] = useState(false);

  useEffect(() => {
    if (open && employee) {
      fetchAttendanceHistory();
      fetchPayrollHistory();
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
              <Badge variant={employee.status === "Active" ? "default" : "secondary"}>
                {employee.status}
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="info">📋 Info</TabsTrigger>
            <TabsTrigger value="attendance">🕐 Kehadiran</TabsTrigger>
            <TabsTrigger value="payroll">💰 Payroll</TabsTrigger>
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
                <div className="sm:col-span-2">
                  <InfoItem icon={MapPin} label="Alamat" value={employee.address || "-"} />
                </div>
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
              </div>
            </div>

            {/* Tunjangan */}
            <div>
              <p className="text-sm font-semibold text-muted-foreground mb-2">📋 Tunjangan Tetap</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Komunikasi</p>
                  <p className="font-semibold text-sm">{formatRupiah(employee.tunjangan_komunikasi)}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Jabatan</p>
                  <p className="font-semibold text-sm">{formatRupiah(employee.tunjangan_jabatan)}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Operasional</p>
                  <p className="font-semibold text-sm">{formatRupiah(employee.tunjangan_operasional)}</p>
                </div>
              </div>
            </div>

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

const InfoItem = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
  <div className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50">
    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
      <Icon className="h-4 w-4 text-primary" />
    </div>
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium text-sm truncate capitalize">{value}</p>
    </div>
  </div>
);

export default EmployeeDetailDialog;
