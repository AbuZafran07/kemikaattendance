import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Upload, Download, Trash2, Plus, Award, Pencil } from "lucide-react";

const STATUSES = ["planned", "ongoing", "completed", "cancelled"] as const;

interface Props {
  employeeId: string;
  canEdit?: boolean; // admin/HR = true, karyawan sendiri = true untuk upload sertifikat
}

interface TrainingRow {
  id: string;
  employee_id: string;
  training_id: string | null;
  training_name: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
  certificate_url: string | null;
  score: number | null;
  expiry_date: string | null;
  notes: string | null;
  created_at: string;
}

interface Program {
  id: string;
  name: string;
  category: string | null;
  provider: string | null;
}

const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    planned: "bg-slate-500",
    ongoing: "bg-blue-500",
    completed: "bg-emerald-600",
    cancelled: "bg-rose-500",
  };
  return <Badge className={map[s] || "bg-slate-500"}>{s}</Badge>;
};

const expiryBadge = (d: string | null) => {
  if (!d) return null;
  const days = Math.ceil((new Date(d + "T00:00:00").getTime() - Date.now()) / 86400000);
  if (days < 0) return <Badge variant="destructive">Kedaluwarsa</Badge>;
  if (days <= 60) return <Badge className="bg-amber-500">{days} hari lagi</Badge>;
  return <Badge variant="secondary">Aktif</Badge>;
};

export const EmployeeTrainings = ({ employeeId, canEdit = true }: Props) => {
  const { toast } = useToast();
  const { profile } = useAuth();
  const [rows, setRows] = useState<TrainingRow[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    training_id: "",
    training_name: "",
    start_date: "",
    end_date: "",
    status: "planned",
    score: "",
    expiry_date: "",
    notes: "",
    file: null as File | null,
  });

  const resetForm = () => {
    setEditingId(null);
    setForm({
      training_id: "", training_name: "", start_date: "", end_date: "",
      status: "planned", score: "", expiry_date: "", notes: "", file: null,
    });
  };

  const load = async () => {
    setLoading(true);
    const [{ data: t, error: e1 }, { data: p }] = await Promise.all([
      supabase.from("employee_trainings").select("*").eq("employee_id", employeeId).order("start_date", { ascending: false }),
      supabase.from("training_programs").select("id,name,category,provider").eq("is_active", true).order("name"),
    ]);
    if (e1) toast({ title: "Gagal memuat training", description: e1.message, variant: "destructive" });
    else setRows((t || []) as TrainingRow[]);
    setPrograms((p || []) as Program[]);
    setLoading(false);
  };

  useEffect(() => { if (employeeId) load(); /* eslint-disable-next-line */ }, [employeeId]);

  const uploadCertificate = async (): Promise<string | null> => {
    if (!form.file) return null;
    if (form.file.size > 10 * 1024 * 1024) throw new Error("Ukuran file maksimal 10MB");
    const ext = form.file.name.split(".").pop() || "bin";
    const path = `${employeeId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("training-certificates")
      .upload(path, form.file, { contentType: form.file.type, upsert: false });
    if (error) throw error;
    return path;
  };

  const handleSubmit = async () => {
    if (!form.training_name.trim()) {
      toast({ title: "Nama training wajib diisi", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      let certPath: string | null = null;
      if (form.file) certPath = await uploadCertificate();

      const payload: any = {
        employee_id: employeeId,
        training_id: form.training_id || null,
        training_name: form.training_name.trim(),
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        status: form.status,
        score: form.score ? Number(form.score) : null,
        expiry_date: form.expiry_date || null,
        notes: form.notes.trim() || null,
      };
      if (certPath) payload.certificate_url = certPath;

      if (editingId) {
        const { error } = await supabase.from("employee_trainings").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        payload.created_by = profile?.id;
        const { error } = await supabase.from("employee_trainings").insert(payload);
        if (error) throw error;
      }

      toast({ title: editingId ? "Training diperbarui" : "Training ditambahkan" });
      setOpen(false);
      resetForm();
      load();
    } catch (e: any) {
      toast({ title: "Gagal menyimpan", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (r: TrainingRow) => {
    setEditingId(r.id);
    setForm({
      training_id: r.training_id || "",
      training_name: r.training_name,
      start_date: r.start_date || "",
      end_date: r.end_date || "",
      status: r.status,
      score: r.score != null ? String(r.score) : "",
      expiry_date: r.expiry_date || "",
      notes: r.notes || "",
      file: null,
    });
    setOpen(true);
  };

  const handleDownload = async (r: TrainingRow) => {
    if (!r.certificate_url) return;
    const { data, error } = await supabase.storage
      .from("training-certificates")
      .createSignedUrl(r.certificate_url, 60);
    if (error || !data?.signedUrl) {
      toast({ title: "Gagal membuka sertifikat", description: error?.message, variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const handleDelete = async (r: TrainingRow) => {
    if (!confirm(`Hapus training "${r.training_name}"?`)) return;
    if (r.certificate_url) {
      await supabase.storage.from("training-certificates").remove([r.certificate_url]).catch(() => {});
    }
    const { error } = await supabase.from("employee_trainings").delete().eq("id", r.id);
    if (error) toast({ title: "Gagal menghapus", description: error.message, variant: "destructive" });
    else { toast({ title: "Training dihapus" }); load(); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Total: {rows.length} training</p>
        {canEdit && (
          <Button size="sm" onClick={() => { resetForm(); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Tambah
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-8">Memuat...</p>
      ) : rows.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">Belum ada training.</p>
      ) : (
        <div className="max-h-[420px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Training</TableHead>
                <TableHead>Periode</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Skor</TableHead>
                <TableHead>Kedaluwarsa</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Award className="h-4 w-4 text-muted-foreground" />
                      <span>{r.training_name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.start_date ? new Date(r.start_date).toLocaleDateString("id-ID") : "-"}
                    {" → "}
                    {r.end_date ? new Date(r.end_date).toLocaleDateString("id-ID") : "-"}
                  </TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
                  <TableCell className="text-xs">{r.score ?? "-"}</TableCell>
                  <TableCell className="text-xs">
                    <div className="flex flex-col gap-1">
                      <span>{r.expiry_date ? new Date(r.expiry_date).toLocaleDateString("id-ID") : "-"}</span>
                      {expiryBadge(r.expiry_date)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    {r.certificate_url && (
                      <Button variant="ghost" size="icon" onClick={() => handleDownload(r)} title="Download sertifikat">
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                    {canEdit && (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(r)} title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(r)} title="Hapus">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Training" : "Tambah Training"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {programs.length > 0 && (
              <div className="space-y-2">
                <Label>Program (opsional)</Label>
                <Select
                  value={form.training_id || "custom"}
                  onValueChange={(v) => {
                    if (v === "custom") setForm({ ...form, training_id: "" });
                    else {
                      const p = programs.find((x) => x.id === v);
                      setForm({ ...form, training_id: v, training_name: p?.name || form.training_name });
                    }
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">— Custom / tidak dari daftar —</SelectItem>
                    {programs.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}{p.provider ? ` — ${p.provider}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Nama Training *</Label>
              <Input value={form.training_name} onChange={(e) => setForm({ ...form, training_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Tgl Mulai</Label>
                <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Tgl Selesai</Label>
                <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Skor</Label>
                <Input type="number" step="0.01" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tgl Kedaluwarsa Sertifikat</Label>
              <Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Sertifikat (opsional, max 10MB — PDF/JPG/PNG)</Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })}
              />
              {editingId && <p className="text-xs text-muted-foreground">Kosongkan jika tidak ingin mengganti sertifikat.</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Batal</Button>
            <Button onClick={handleSubmit} disabled={busy}>
              <Upload className="h-4 w-4 mr-1" />
              {busy ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
