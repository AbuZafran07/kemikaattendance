import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, ArrowLeft, HeartHandshake } from "lucide-react";

interface SpecialLeaveType {
  id: string;
  code: string;
  name: string;
  default_duration_days: number;
  requires_document: boolean;
  is_active: boolean;
  display_order: number;
}

const EMPTY_FORM = {
  code: "",
  name: "",
  default_duration_days: 1,
  requires_document: true,
  is_active: true,
  display_order: 0,
};

export default function SpecialLeaveTypesSettings() {
  const navigate = useNavigate();
  const [types, setTypes] = useState<SpecialLeaveType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const fetchTypes = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("special_leave_types" as any)
      .select("*")
      .order("display_order", { ascending: true });

    if (!error && data) setTypes(data as unknown as SpecialLeaveType[]);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchTypes();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, display_order: types.length });
    setDialogOpen(true);
  };

  const openEdit = (t: SpecialLeaveType) => {
    setEditingId(t.id);
    setForm({
      code: t.code,
      name: t.name,
      default_duration_days: t.default_duration_days,
      requires_document: t.requires_document,
      is_active: t.is_active,
      display_order: t.display_order,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      toast({ title: "Error", description: "Kode dan nama wajib diisi", variant: "destructive" });
      return;
    }
    if (form.default_duration_days < 1) {
      toast({ title: "Error", description: "Durasi minimal 1 hari", variant: "destructive" });
      return;
    }
    setIsSaving(true);

    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      default_duration_days: form.default_duration_days,
      requires_document: form.requires_document,
      is_active: form.is_active,
      display_order: form.display_order,
    };

    const { error } = editingId
      ? await supabase.from("special_leave_types" as any).update(payload as any).eq("id", editingId)
      : await supabase.from("special_leave_types" as any).insert(payload as any);

    if (error) {
      toast({ title: "Gagal Menyimpan", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Berhasil", description: editingId ? "Jenis izin khusus diperbarui" : "Jenis izin khusus ditambahkan" });
      setDialogOpen(false);
      fetchTypes();
    }
    setIsSaving(false);
  };

  const handleDelete = async (t: SpecialLeaveType) => {
    if (!confirm(`Yakin ingin menghapus "${t.name}"? Pengajuan lama yang sudah memakai jenis ini akan tetap tersimpan.`)) return;
    const { error } = await supabase.from("special_leave_types" as any).delete().eq("id", t.id);
    if (error) {
      toast({ title: "Gagal Menghapus", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Berhasil", description: "Jenis izin khusus dihapus" });
      fetchTypes();
    }
  };

  const toggleActive = async (t: SpecialLeaveType) => {
    await supabase.from("special_leave_types" as any).update({ is_active: !t.is_active } as any).eq("id", t.id);
    fetchTypes();
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6 animate-fadeIn">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/settings")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Jenis Izin Khusus</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Kelola jenis izin life-event (pernikahan, kematian, dll) yang tidak memotong kuota cuti/izin/sakit.
              </p>
            </div>
          </div>
          <Button onClick={openAdd} className="gap-2">
            <Plus className="h-4 w-4" /> Tambah Jenis
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <HeartHandshake className="h-4 w-4 text-primary" />
              Daftar Jenis Izin Khusus
            </CardTitle>
            <CardDescription>
              Jenis yang dinonaktifkan tidak akan muncul lagi di form pengajuan karyawan, tapi histori pengajuan lama tetap tampil normal.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Memuat...</div>
            ) : types.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Belum ada jenis izin khusus</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama</TableHead>
                      <TableHead className="hidden sm:table-cell">Kode</TableHead>
                      <TableHead>Durasi</TableHead>
                      <TableHead className="hidden sm:table-cell">Wajib Dokumen</TableHead>
                      <TableHead>Aktif</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {types.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium text-sm">{t.name}</TableCell>
                        <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{t.code}</TableCell>
                        <TableCell className="text-sm">{t.default_duration_days} hari</TableCell>
                        <TableCell className="hidden sm:table-cell text-sm">{t.requires_document ? "Ya" : "Tidak"}</TableCell>
                        <TableCell>
                          <Switch checked={t.is_active} onCheckedChange={() => toggleActive(t)} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(t)} className="text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Jenis Izin Khusus" : "Tambah Jenis Izin Khusus"}</DialogTitle>
            <DialogDescription>Durasi berlaku untuk pengajuan baru, tidak mengubah pengajuan yang sudah ada.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nama</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Contoh: Pernikahan Karyawan"
              />
            </div>
            <div>
              <Label>Kode (unik, tanpa spasi)</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.trim().toLowerCase().replace(/\s+/g, "_") })}
                placeholder="marriage_self"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Durasi Default (hari)</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.default_duration_days}
                  onChange={(e) => setForm({ ...form, default_duration_days: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div>
                <Label>Urutan Tampil</Label>
                <Input
                  type="number"
                  value={form.display_order}
                  onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.requires_document}
                onCheckedChange={(v) => setForm({ ...form, requires_document: v })}
              />
              <Label>Wajib upload dokumen pendukung</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>Aktif (tampil di form pengajuan karyawan)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
