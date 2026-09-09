import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Pencil, Check, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface SpecialLeaveType {
  id: string;
  code: string;
  name: string;
  default_duration_days: number;
  requires_document: boolean;
  is_active: boolean;
  display_order: number;
}

const slugify = (name: string) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "izin_khusus";

const emptyForm = { name: "", default_duration_days: 1, requires_document: true };

export default function SpecialLeaveTypesSettings() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [types, setTypes] = useState<SpecialLeaveType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [newForm, setNewForm] = useState(emptyForm);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);

  useEffect(() => {
    fetchTypes();
  }, []);

  const fetchTypes = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("special_leave_types")
      .select("id, code, name, default_duration_days, requires_document, is_active, display_order")
      .order("display_order");
    if (error) {
      toast({ title: "Gagal Memuat Data", description: error.message, variant: "destructive" });
    } else {
      setTypes(data || []);
    }
    setIsLoading(false);
  };

  const handleAdd = async () => {
    if (!newForm.name.trim()) {
      toast({ title: "Nama harus diisi", variant: "destructive" });
      return;
    }
    if (newForm.default_duration_days < 1) {
      toast({ title: "Durasi minimal 1 hari", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    const nextOrder = types.length > 0 ? Math.max(...types.map((t) => t.display_order)) + 1 : 1;
    const { error } = await supabase.from("special_leave_types").insert({
      code: `${slugify(newForm.name)}_${Date.now().toString(36)}`,
      name: newForm.name.trim(),
      default_duration_days: newForm.default_duration_days,
      requires_document: newForm.requires_document,
      display_order: nextOrder,
    });
    setIsSaving(false);
    if (error) {
      toast({ title: "Gagal Menambahkan", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Berhasil", description: "Jenis izin khusus berhasil ditambahkan." });
      setNewForm(emptyForm);
      fetchTypes();
    }
  };

  const startEdit = (t: SpecialLeaveType) => {
    setEditingId(t.id);
    setEditForm({
      name: t.name,
      default_duration_days: t.default_duration_days,
      requires_document: t.requires_document,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(emptyForm);
  };

  const saveEdit = async () => {
    if (!editingId || !editForm.name.trim() || editForm.default_duration_days < 1) return;
    const { error } = await supabase
      .from("special_leave_types")
      .update({
        name: editForm.name.trim(),
        default_duration_days: editForm.default_duration_days,
        requires_document: editForm.requires_document,
      })
      .eq("id", editingId);
    if (error) {
      toast({ title: "Gagal Menyimpan", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Berhasil", description: "Perubahan disimpan." });
      cancelEdit();
      fetchTypes();
    }
  };

  const toggleActive = async (t: SpecialLeaveType) => {
    const { error } = await supabase
      .from("special_leave_types")
      .update({ is_active: !t.is_active })
      .eq("id", t.id);
    if (error) {
      toast({ title: "Gagal Mengubah Status", description: error.message, variant: "destructive" });
    } else {
      fetchTypes();
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6 animate-fadeIn">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/settings")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Jenis Izin Khusus</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Kelola jenis izin life-event (pernikahan, duka, dll) beserta durasi tetapnya. Izin khusus tidak memotong kuota cuti tahunan/izin/sakit.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tambah Jenis Baru</CardTitle>
            <CardDescription>Durasi bisa disesuaikan kapan saja tanpa perlu ubah kode aplikasi</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-[1fr_140px_160px_auto] items-end">
              <div className="space-y-2">
                <Label>Nama Jenis Izin</Label>
                <Input
                  placeholder="mis. Pernikahan Karyawan"
                  value={newForm.name}
                  onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Durasi (hari)</Label>
                <Input
                  type="number"
                  min={1}
                  value={newForm.default_duration_days}
                  onChange={(e) => setNewForm({ ...newForm, default_duration_days: Number(e.target.value) || 1 })}
                />
              </div>
              <div className="flex items-center gap-2 pb-2">
                <Switch
                  checked={newForm.requires_document}
                  onCheckedChange={(checked) => setNewForm({ ...newForm, requires_document: checked })}
                />
                <Label className="text-sm">Wajib Lampiran</Label>
              </div>
              <Button onClick={handleAdd} disabled={isSaving} className="gap-2">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Tambah
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Daftar Jenis Izin Khusus</CardTitle>
            <CardDescription>{types.filter((t) => t.is_active).length} aktif dari {types.length} jenis</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : types.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Belum ada jenis izin khusus</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama</TableHead>
                      <TableHead>Durasi</TableHead>
                      <TableHead>Wajib Lampiran</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {types.map((t) => (
                      <TableRow key={t.id}>
                        {editingId === t.id ? (
                          <>
                            <TableCell>
                              <Input
                                value={editForm.name}
                                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                className="h-8"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={1}
                                value={editForm.default_duration_days}
                                onChange={(e) => setEditForm({ ...editForm, default_duration_days: Number(e.target.value) || 1 })}
                                className="h-8 w-20"
                              />
                            </TableCell>
                            <TableCell>
                              <Switch
                                checked={editForm.requires_document}
                                onCheckedChange={(checked) => setEditForm({ ...editForm, requires_document: checked })}
                              />
                            </TableCell>
                            <TableCell>
                              <Badge variant={t.is_active ? "default" : "outline"}>{t.is_active ? "Aktif" : "Nonaktif"}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-primary" onClick={saveEdit}>
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={cancelEdit}>
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell className="font-medium">{t.name}</TableCell>
                            <TableCell>{t.default_duration_days} hari</TableCell>
                            <TableCell>{t.requires_document ? "Ya" : "Tidak"}</TableCell>
                            <TableCell>
                              <button onClick={() => toggleActive(t)} className="cursor-pointer">
                                <Badge variant={t.is_active ? "default" : "outline"}>{t.is_active ? "Aktif" : "Nonaktif"}</Badge>
                              </button>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(t)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
