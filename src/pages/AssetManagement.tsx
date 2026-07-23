import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Laptop, Plus, ArrowLeftRight, RotateCcw, Trash2, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const CATEGORIES = ["Laptop", "Handphone", "Monitor", "Aksesoris", "Kendaraan", "Lainnya"];
const CONDITIONS = ["good", "fair", "damaged"];
const STATUSES = ["available", "assigned", "maintenance", "lost"];

const formatRp = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0);

export default function AssetManagement() {
  const { toast } = useToast();
  const [assets, setAssets] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("assets");

  const [assetDialog, setAssetDialog] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({
    asset_code: "", name: "", category: "Laptop", brand: "", serial_number: "",
    purchase_date: "", purchase_price: 0, condition: "good", status: "available", notes: "",
  });

  const [assignDialog, setAssignDialog] = useState(false);
  const [assignForm, setAssignForm] = useState<any>({ asset_id: "", employee_id: "", condition_out: "good", notes: "" });

  const [returnDialog, setReturnDialog] = useState(false);
  const [returning, setReturning] = useState<any>(null);
  const [returnForm, setReturnForm] = useState<any>({ condition_in: "good", notes: "" });

  const fetchAll = async () => {
    setLoading(true);
    const [a, ass, emp] = await Promise.all([
      supabase.from("assets" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("asset_assignments" as any).select("*").order("assigned_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name, jabatan, departemen, status").order("full_name"),
    ]);
    setAssets(((a.data as any[]) || []));
    setAssignments(((ass.data as any[]) || []));
    setEmployees(((emp.data as any[]) || []));
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const empName = (id: string) => employees.find((e) => e.id === id)?.full_name || "-";
  const assetLabel = (id: string) => {
    const a = assets.find((x) => x.id === id);
    return a ? `${a.asset_code} — ${a.name}` : "-";
  };

  const resetForm = () => {
    setEditing(null);
    setForm({
      asset_code: "", name: "", category: "Laptop", brand: "", serial_number: "",
      purchase_date: "", purchase_price: 0, condition: "good", status: "available", notes: "",
    });
  };

  const openEdit = (a: any) => {
    setEditing(a);
    setForm({
      asset_code: a.asset_code || "", name: a.name || "", category: a.category || "Laptop",
      brand: a.brand || "", serial_number: a.serial_number || "",
      purchase_date: a.purchase_date || "", purchase_price: Number(a.purchase_price) || 0,
      condition: a.condition || "good", status: a.status || "available", notes: a.notes || "",
    });
    setAssetDialog(true);
  };

  const saveAsset = async () => {
    if (!form.asset_code.trim() || !form.name.trim()) {
      toast({ title: "Kode & nama aset wajib diisi", variant: "destructive" }); return;
    }
    const payload: any = { ...form, purchase_price: Number(form.purchase_price) || 0 };
    if (!payload.purchase_date) payload.purchase_date = null;
    const q = editing
      ? supabase.from("assets" as any).update(payload).eq("id", editing.id)
      : supabase.from("assets" as any).insert(payload);
    const { error } = await q;
    if (error) { toast({ title: "Gagal menyimpan", description: error.message, variant: "destructive" }); return; }
    toast({ title: editing ? "Aset diperbarui" : "Aset ditambahkan" });
    setAssetDialog(false); resetForm(); fetchAll();
  };

  const deleteAsset = async (id: string) => {
    if (!confirm("Hapus aset ini beserta riwayat assignment?")) return;
    const { error } = await supabase.from("assets" as any).delete().eq("id", id);
    if (error) { toast({ title: "Gagal hapus", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Aset dihapus" });
    fetchAll();
  };

  const assignAsset = async () => {
    if (!assignForm.asset_id || !assignForm.employee_id) {
      toast({ title: "Aset & karyawan wajib dipilih", variant: "destructive" }); return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("asset_assignments" as any).insert({
      asset_id: assignForm.asset_id,
      employee_id: assignForm.employee_id,
      condition_out: assignForm.condition_out,
      notes: assignForm.notes || null,
      assigned_by: user?.id,
    });
    if (error) { toast({ title: "Gagal assign", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Aset di-assign" });
    setAssignDialog(false);
    setAssignForm({ asset_id: "", employee_id: "", condition_out: "good", notes: "" });
    fetchAll();
  };

  const openReturn = (a: any) => {
    setReturning(a);
    setReturnForm({ condition_in: a.condition_out || "good", notes: "" });
    setReturnDialog(true);
  };

  const returnAsset = async () => {
    if (!returning?.id) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("asset_assignments" as any).update({
      returned_at: new Date().toISOString(),
      condition_in: returnForm.condition_in,
      notes: returnForm.notes ? `${returning.notes || ""}${returning.notes ? " | " : ""}RETURN: ${returnForm.notes}` : returning.notes,
      returned_by: user?.id,
    }).eq("id", returning.id);
    if (error) { toast({ title: "Gagal return", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Aset dikembalikan" });
    setReturnDialog(false);
    setReturning(null);
    fetchAll();
  };

  const activeAssignments = assignments.filter((a) => !a.returned_at);
  const historyAssignments = assignments.filter((a) => a.returned_at);

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Laptop className="h-6 w-6" /> Manajemen Aset</h1>
            <p className="text-sm text-muted-foreground">Kelola aset perusahaan (laptop, HP, dll) & assignment ke karyawan.</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => { resetForm(); setAssetDialog(true); }}><Plus className="h-4 w-4 mr-1" /> Tambah Aset</Button>
            <Button variant="outline" onClick={() => setAssignDialog(true)}><ArrowLeftRight className="h-4 w-4 mr-1" /> Assign Aset</Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="assets">Master Aset ({assets.length})</TabsTrigger>
            <TabsTrigger value="active">Sedang Dipegang ({activeAssignments.length})</TabsTrigger>
            <TabsTrigger value="history">Riwayat ({historyAssignments.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="assets" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Daftar Aset</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kode</TableHead><TableHead>Nama</TableHead><TableHead>Kategori</TableHead>
                      <TableHead>Brand / SN</TableHead><TableHead>Harga</TableHead>
                      <TableHead>Kondisi</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assets.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono text-xs">{a.asset_code}</TableCell>
                        <TableCell>{a.name}</TableCell>
                        <TableCell>{a.category}</TableCell>
                        <TableCell className="text-xs">{a.brand || "-"}{a.serial_number ? ` / ${a.serial_number}` : ""}</TableCell>
                        <TableCell>{formatRp(Number(a.purchase_price) || 0)}</TableCell>
                        <TableCell><Badge variant="outline">{a.condition}</Badge></TableCell>
                        <TableCell>
                          <Badge variant={a.status === "available" ? "default" : a.status === "assigned" ? "secondary" : "destructive"}>{a.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(a)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => deleteAsset(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {assets.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Belum ada aset.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="active" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Aset Sedang Dipegang Karyawan</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Aset</TableHead><TableHead>Karyawan</TableHead>
                    <TableHead>Tgl Assign</TableHead><TableHead>Kondisi Keluar</TableHead>
                    <TableHead>Catatan</TableHead><TableHead className="text-right">Aksi</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {activeAssignments.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>{assetLabel(a.asset_id)}</TableCell>
                        <TableCell>{empName(a.employee_id)}</TableCell>
                        <TableCell>{new Date(a.assigned_at).toLocaleDateString("id-ID")}</TableCell>
                        <TableCell><Badge variant="outline">{a.condition_out || "-"}</Badge></TableCell>
                        <TableCell className="text-xs max-w-xs truncate">{a.notes || "-"}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => openReturn(a)}><RotateCcw className="h-4 w-4 mr-1" /> Return</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {activeAssignments.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Tidak ada aset yang sedang dipegang.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Riwayat Pengembalian</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Aset</TableHead><TableHead>Karyawan</TableHead>
                    <TableHead>Periode</TableHead><TableHead>Keluar → Kembali</TableHead>
                    <TableHead>Catatan</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {historyAssignments.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>{assetLabel(a.asset_id)}</TableCell>
                        <TableCell>{empName(a.employee_id)}</TableCell>
                        <TableCell className="text-xs">
                          {new Date(a.assigned_at).toLocaleDateString("id-ID")} → {new Date(a.returned_at).toLocaleDateString("id-ID")}
                        </TableCell>
                        <TableCell className="text-xs">{a.condition_out || "-"} → {a.condition_in || "-"}</TableCell>
                        <TableCell className="text-xs max-w-xs truncate">{a.notes || "-"}</TableCell>
                      </TableRow>
                    ))}
                    {historyAssignments.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Belum ada riwayat.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Asset Dialog */}
      <Dialog open={assetDialog} onOpenChange={setAssetDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Aset" : "Tambah Aset"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Kode Aset *</Label><Input value={form.asset_code} onChange={(e) => setForm({ ...form, asset_code: e.target.value })} placeholder="AST-001" /></div>
            <div className="space-y-1"><Label>Kategori</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1 col-span-2"><Label>Nama *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1"><Label>Brand</Label><Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></div>
            <div className="space-y-1"><Label>Serial Number</Label><Input value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} /></div>
            <div className="space-y-1"><Label>Tgl Beli</Label><Input type="date" value={form.purchase_date || ""} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} /></div>
            <div className="space-y-1"><Label>Harga Beli</Label><Input type="number" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} /></div>
            <div className="space-y-1"><Label>Kondisi</Label>
              <Select value={form.condition} onValueChange={(v) => setForm({ ...form, condition: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CONDITIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1 col-span-2"><Label>Catatan</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssetDialog(false)}>Batal</Button>
            <Button onClick={saveAsset}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Dialog */}
      <Dialog open={assignDialog} onOpenChange={setAssignDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Aset ke Karyawan</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Aset (available)</Label>
              <Select value={assignForm.asset_id} onValueChange={(v) => setAssignForm({ ...assignForm, asset_id: v })}>
                <SelectTrigger><SelectValue placeholder="Pilih aset" /></SelectTrigger>
                <SelectContent>
                  {assets.filter((a) => a.status === "available").map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.asset_code} — {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Karyawan</Label>
              <Select value={assignForm.employee_id} onValueChange={(v) => setAssignForm({ ...assignForm, employee_id: v })}>
                <SelectTrigger><SelectValue placeholder="Pilih karyawan" /></SelectTrigger>
                <SelectContent>
                  {employees.filter((e) => e.status === "Active").map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.full_name} — {e.jabatan}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Kondisi saat diserahkan</Label>
              <Select value={assignForm.condition_out} onValueChange={(v) => setAssignForm({ ...assignForm, condition_out: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CONDITIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Catatan</Label>
              <Textarea rows={2} value={assignForm.notes} onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialog(false)}>Batal</Button>
            <Button onClick={assignAsset}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Dialog */}
      <Dialog open={returnDialog} onOpenChange={setReturnDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Return Aset</DialogTitle></DialogHeader>
          {returning && (
            <div className="space-y-3">
              <p className="text-sm">{assetLabel(returning.asset_id)} — <b>{empName(returning.employee_id)}</b></p>
              <div className="space-y-1"><Label>Kondisi saat dikembalikan</Label>
                <Select value={returnForm.condition_in} onValueChange={(v) => setReturnForm({ ...returnForm, condition_in: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CONDITIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Catatan pengembalian</Label>
                <Textarea rows={2} value={returnForm.notes} onChange={(e) => setReturnForm({ ...returnForm, notes: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnDialog(false)}>Batal</Button>
            <Button onClick={returnAsset}>Konfirmasi Return</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
