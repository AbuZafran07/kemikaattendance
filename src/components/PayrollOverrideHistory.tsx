import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FileSpreadsheet, Loader2, Pencil, Trash2, Search, X } from "lucide-react";
import { formatRupiah } from "@/lib/payrollCalculation";
import { exportToExcelFile } from "@/lib/excelExport";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const MONTHS = [
  { value: 1, label: "Januari" }, { value: 2, label: "Februari" }, { value: 3, label: "Maret" },
  { value: 4, label: "April" }, { value: 5, label: "Mei" }, { value: 6, label: "Juni" },
  { value: 7, label: "Juli" }, { value: 8, label: "Agustus" }, { value: 9, label: "September" },
  { value: 10, label: "Oktober" }, { value: 11, label: "November" }, { value: 12, label: "Desember" },
];

interface OverrideRow {
  id: string;
  user_id: string;
  period_month: number;
  period_year: number;
  tunjangan_kehadiran: number;
  tunjangan_kesehatan: number;
  bonus_tahunan: number;
  thr: number;
  insentif_kinerja: number;
  bonus_lainnya: number;
  pengembalian_employee: number;
  insentif_penjualan: number;
  overtime_override: number;
  loan_deduction: number;
  other_deduction: number;
  deduction_notes: string | null;
  employee_name?: string;
}

const currentDate = new Date();

const PayrollOverrideHistory = () => {
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [editItem, setEditItem] = useState<OverrideRow | null>(null);
  const [deleteItem, setDeleteItem] = useState<OverrideRow | null>(null);
  const { toast } = useToast();

  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i);

  useEffect(() => { fetchOverrides(); }, [selectedMonth, selectedYear]);

  const fetchOverrides = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("payroll_overrides")
        .select("*")
        .eq("period_month", selectedMonth)
        .eq("period_year", selectedYear);

      if (error) throw error;

      const userIds = [...new Set((data || []).map(d => d.user_id))];
      let profileMap = new Map<string, string>();
      let adminIds = new Set<string>();

      if (userIds.length > 0) {
        const [{ data: profiles }, { data: adminRoles }] = await Promise.all([
          supabase.from("profiles").select("id, full_name").in("id", userIds),
          supabase.from("user_roles").select("user_id").eq("role", "admin"),
        ]);
        profileMap = new Map((profiles || []).map(p => [p.id, p.full_name]));
        adminIds = new Set((adminRoles || []).map(r => r.user_id));
      }

      setOverrides((data || []).filter(d => !adminIds.has(d.user_id)).map(d => ({
        ...d,
        tunjangan_kehadiran: Number(d.tunjangan_kehadiran) || 0,
        tunjangan_kesehatan: Number(d.tunjangan_kesehatan) || 0,
        bonus_tahunan: Number(d.bonus_tahunan) || 0,
        thr: Number(d.thr) || 0,
        insentif_kinerja: Number(d.insentif_kinerja) || 0,
        bonus_lainnya: Number(d.bonus_lainnya) || 0,
        pengembalian_employee: Number(d.pengembalian_employee) || 0,
        insentif_penjualan: Number(d.insentif_penjualan) || 0,
        overtime_override: Number((d as any).overtime_override) || 0,
        loan_deduction: Number(d.loan_deduction) || 0,
        other_deduction: Number(d.other_deduction) || 0,
        employee_name: profileMap.get(d.user_id) || "Unknown",
      })).sort((a, b) => (a.employee_name || "").localeCompare(b.employee_name || "")));
    } catch (error: any) {
      console.error("Error fetching overrides:", error);
      toast({ title: "Gagal", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editItem) return;
    try {
      const { error } = await supabase
        .from("payroll_overrides")
        .update({
          tunjangan_kehadiran: editItem.tunjangan_kehadiran,
          tunjangan_kesehatan: editItem.tunjangan_kesehatan,
          bonus_tahunan: editItem.bonus_tahunan,
          thr: editItem.thr,
          insentif_kinerja: editItem.insentif_kinerja,
          bonus_lainnya: editItem.bonus_lainnya,
          pengembalian_employee: editItem.pengembalian_employee,
          insentif_penjualan: editItem.insentif_penjualan,
          overtime_override: editItem.overtime_override,
          loan_deduction: editItem.loan_deduction,
          other_deduction: editItem.other_deduction,
          deduction_notes: editItem.deduction_notes || "",
        } as any)
        .eq("id", editItem.id);

      if (error) throw error;
      toast({ title: "Berhasil", description: `Override ${editItem.employee_name} berhasil diperbarui.` });
      setEditItem(null);
      fetchOverrides();
    } catch (error: any) {
      toast({ title: "Gagal", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      const { error } = await supabase
        .from("payroll_overrides")
        .delete()
        .eq("id", deleteItem.id);

      if (error) throw error;
      toast({ title: "Berhasil", description: `Override ${deleteItem.employee_name} berhasil dihapus.` });
      setDeleteItem(null);
      fetchOverrides();
    } catch (error: any) {
      toast({ title: "Gagal", description: error.message, variant: "destructive" });
    }
  };

  const handleExportExcel = async () => {
    if (overrides.length === 0) return;
    const data = overrides.map((item, idx) => ({
      "No": idx + 1,
      "Nama Karyawan": item.employee_name || "-",
      "Tunj. Kehadiran": item.tunjangan_kehadiran,
      "Tunj. Kesehatan": item.tunjangan_kesehatan,
      "Bonus Tahunan": item.bonus_tahunan,
      "THR": item.thr,
      "Insentif Kinerja": item.insentif_kinerja,
      "Bonus Lainnya": item.bonus_lainnya,
      "Pengembalian": item.pengembalian_employee,
      "Insentif Penjualan": item.insentif_penjualan,
      "Total Tambahan": item.tunjangan_kehadiran + item.tunjangan_kesehatan + item.bonus_tahunan + item.thr + item.insentif_kinerja + item.bonus_lainnya + item.pengembalian_employee + item.insentif_penjualan,
      "Pot. Pinjaman": item.loan_deduction,
      "Pot. Lainnya": item.other_deduction,
      "Total Potongan": item.loan_deduction + item.other_deduction,
      "Catatan": item.deduction_notes || "",
    }));

    await exportToExcelFile(
      data,
      `Override_${MONTHS[selectedMonth - 1].label}_${selectedYear}`,
      `Override Potongan & Tambahan - ${MONTHS[selectedMonth - 1].label} ${selectedYear}`,
    );
  };

  const filtered = overrides.filter(o =>
    (o.employee_name || "").toLowerCase().includes(search.toLowerCase())
  );

  const updateEditField = (field: string, value: string) => {
    if (!editItem) return;
    setEditItem({ ...editItem, [field]: field === "deduction_notes" ? value : Number(value) || 0 });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>{MONTHS.map((m) => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
          <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
          <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari karyawan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
        {overrides.length > 0 && (
          <Button variant="outline" onClick={handleExportExcel} className="gap-2">
            <FileSpreadsheet className="h-4 w-4" /> Export Excel
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Data Override — {MONTHS[selectedMonth - 1].label} {selectedYear}</CardTitle>
          <CardDescription>
            Daftar input potongan dan tambahan penghasilan per karyawan. Total: {overrides.length} karyawan
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="font-medium">{overrides.length === 0 ? "Belum ada data override" : "Tidak ditemukan"}</p>
              <p className="text-sm mt-1">{overrides.length === 0 ? "Input potongan atau tambahan penghasilan dari tab Payroll untuk memulai." : "Coba ubah kata pencarian."}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">No</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead className="text-right">Tambahan Penghasilan</TableHead>
                    <TableHead className="text-right">Total Potongan</TableHead>
                    <TableHead>Catatan</TableHead>
                    <TableHead className="w-[100px]">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((item, idx) => {
                    const totalIncome = item.tunjangan_kehadiran + item.tunjangan_kesehatan + item.bonus_tahunan + item.thr + item.insentif_kinerja + item.bonus_lainnya + item.pengembalian_employee + item.insentif_penjualan + item.overtime_override;
                    const totalDeduction = item.loan_deduction + item.other_deduction;
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-medium">{item.employee_name}</TableCell>
                        <TableCell className="text-right">
                          {totalIncome > 0 ? (
                            <div>
                              <span className="font-medium text-primary">{formatRupiah(totalIncome)}</span>
                              <div className="flex flex-wrap gap-1 justify-end mt-1">
                                {item.tunjangan_kehadiran > 0 && <Badge variant="outline" className="text-[9px]">Kehadiran</Badge>}
                                {item.tunjangan_kesehatan > 0 && <Badge variant="outline" className="text-[9px]">Kesehatan</Badge>}
                                {item.bonus_tahunan > 0 && <Badge variant="outline" className="text-[9px]">Bonus</Badge>}
                                {item.thr > 0 && <Badge variant="outline" className="text-[9px]">THR</Badge>}
                                {item.insentif_kinerja > 0 && <Badge variant="outline" className="text-[9px]">Kinerja</Badge>}
                                {item.bonus_lainnya > 0 && <Badge variant="outline" className="text-[9px]">Lainnya</Badge>}
                                {item.pengembalian_employee > 0 && <Badge variant="outline" className="text-[9px]">Pengembalian</Badge>}
                                {item.insentif_penjualan > 0 && <Badge variant="outline" className="text-[9px]">Penjualan</Badge>}
                                {item.overtime_override > 0 && <Badge variant="outline" className="text-[9px]">Lembur</Badge>}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {totalDeduction > 0 ? (
                            <div>
                              <span className="font-medium text-destructive">{formatRupiah(totalDeduction)}</span>
                              <div className="flex flex-wrap gap-1 justify-end mt-1">
                                {item.loan_deduction > 0 && <Badge variant="secondary" className="text-[9px]">Pinjaman</Badge>}
                                {item.other_deduction > 0 && <Badge variant="secondary" className="text-[9px]">Lainnya</Badge>}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate text-xs text-muted-foreground">
                          {item.deduction_notes || "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditItem(item)} title="Edit">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteItem(item)} title="Hapus">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Override</DialogTitle>
            <DialogDescription>{editItem?.employee_name} — {MONTHS[selectedMonth - 1].label} {selectedYear}</DialogDescription>
          </DialogHeader>
          {editItem && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold mb-2">💰 Tambahan Penghasilan</p>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    ["tunjangan_kehadiran", "Tunj. Kehadiran"],
                    ["tunjangan_kesehatan", "Tunj. Kesehatan"],
                    ["bonus_tahunan", "Bonus Tahunan"],
                    ["thr", "THR"],
                    ["insentif_kinerja", "Insentif Kinerja"],
                    ["bonus_lainnya", "Bonus Lainnya"],
                    ["pengembalian_employee", "Pengembalian"],
                    ["insentif_penjualan", "Insentif Penjualan"],
                  ] as const).map(([field, label]) => (
                    <div key={field}>
                      <Label className="text-xs">{label}</Label>
                      <Input
                        type="number"
                        value={(editItem as any)[field] || ""}
                        placeholder="0"
                        onChange={(e) => updateEditField(field, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold mb-2">📋 Potongan</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Pinjaman/Kasbon</Label>
                    <Input type="number" value={editItem.loan_deduction || ""} placeholder="0"
                      onChange={(e) => updateEditField("loan_deduction", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Potongan Lain</Label>
                    <Input type="number" value={editItem.other_deduction || ""} placeholder="0"
                      onChange={(e) => updateEditField("other_deduction", e.target.value)} />
                  </div>
                </div>
                <div className="mt-2">
                  <Label className="text-xs">Catatan Potongan</Label>
                  <Textarea rows={2} value={editItem.deduction_notes || ""} placeholder="Keterangan..."
                    onChange={(e) => updateEditField("deduction_notes", e.target.value)} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>Batal</Button>
            <Button onClick={handleSaveEdit}>Simpan Perubahan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Override?</AlertDialogTitle>
            <AlertDialogDescription>
              Data override potongan & tambahan penghasilan untuk <strong>{deleteItem?.employee_name}</strong> pada periode {MONTHS[selectedMonth - 1].label} {selectedYear} akan dihapus. Tindakan ini tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PayrollOverrideHistory;
