import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, GraduationCap, AlertTriangle, Users, Download } from "lucide-react";

interface Program {
  id: string;
  name: string;
  category: string | null;
  provider: string | null;
  cost: number | null;
  duration_hours: number | null;
  description: string | null;
  is_active: boolean;
}

interface HistoryRow {
  id: string;
  employee_id: string;
  training_name: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
  score: number | null;
  expiry_date: string | null;
  certificate_url: string | null;
  profiles: { full_name: string; departemen: string | null } | null;
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

const daysUntil = (d: string) =>
  Math.ceil((new Date(d + "T00:00:00").getTime() - Date.now()) / 86400000);

const Training = () => {
  const { toast } = useToast();
  const { profile } = useAuth();
  const [tab, setTab] = useState("programs");
  const [programs, setPrograms] = useState<Program[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [progOpen, setProgOpen] = useState(false);
  const [progEditId, setProgEditId] = useState<string | null>(null);
  const [progForm, setProgForm] = useState({
    name: "", category: "", provider: "", cost: "", duration_hours: "", description: "", is_active: true,
  });

  const load = async () => {
    setLoading(true);
    const [{ data: p }, { data: h }] = await Promise.all([
      supabase.from("training_programs").select("*").order("created_at", { ascending: false }),
      supabase.from("employee_trainings")
        .select("id,employee_id,training_name,start_date,end_date,status,score,expiry_date,certificate_url")
        .order("start_date", { ascending: false }),
    ]);
    setPrograms((p || []) as Program[]);

    // client-side join dgn profiles
    const rows = (h || []) as any[];
    const ids = Array.from(new Set(rows.map((r) => r.employee_id)));
    let profMap = new Map<string, { full_name: string; departemen: string | null }>();
    if (ids.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id,full_name,departemen").in("id", ids);
      (profs || []).forEach((x: any) => profMap.set(x.id, { full_name: x.full_name, departemen: x.departemen }));
    }
    setHistory(rows.map((r) => ({ ...r, profiles: profMap.get(r.employee_id) || null })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const expiring = useMemo(
    () => history.filter((r) => r.expiry_date && daysUntil(r.expiry_date) <= 60).sort(
      (a, b) => daysUntil(a.expiry_date!) - daysUntil(b.expiry_date!),
    ),
    [history],
  );

  const resetProg = () => {
    setProgEditId(null);
    setProgForm({ name: "", category: "", provider: "", cost: "", duration_hours: "", description: "", is_active: true });
  };

  const submitProgram = async () => {
    if (!progForm.name.trim()) { toast({ title: "Nama program wajib diisi", variant: "destructive" }); return; }
    const payload: any = {
      name: progForm.name.trim(),
      category: progForm.category.trim() || null,
      provider: progForm.provider.trim() || null,
      cost: progForm.cost ? Number(progForm.cost) : 0,
      duration_hours: progForm.duration_hours ? Number(progForm.duration_hours) : null,
      description: progForm.description.trim() || null,
      is_active: progForm.is_active,
    };
    let err;
    if (progEditId) ({ error: err } = await supabase.from("training_programs").update(payload).eq("id", progEditId));
    else {
      payload.created_by = profile?.id;
      ({ error: err } = await supabase.from("training_programs").insert(payload));
    }
    if (err) toast({ title: "Gagal menyimpan", description: err.message, variant: "destructive" });
    else { toast({ title: progEditId ? "Program diperbarui" : "Program ditambahkan" }); setProgOpen(false); resetProg(); load(); }
  };

  const openEditProgram = (p: Program) => {
    setProgEditId(p.id);
    setProgForm({
      name: p.name,
      category: p.category || "",
      provider: p.provider || "",
      cost: p.cost != null ? String(p.cost) : "",
      duration_hours: p.duration_hours != null ? String(p.duration_hours) : "",
      description: p.description || "",
      is_active: p.is_active,
    });
    setProgOpen(true);
  };

  const deleteProgram = async (p: Program) => {
    if (!confirm(`Hapus program "${p.name}"?`)) return;
    const { error } = await supabase.from("training_programs").delete().eq("id", p.id);
    if (error) toast({ title: "Gagal menghapus", description: error.message, variant: "destructive" });
    else { toast({ title: "Program dihapus" }); load(); }
  };

  const downloadCert = async (r: HistoryRow) => {
    if (!r.certificate_url) return;
    const { data, error } = await supabase.storage
      .from("training-certificates").createSignedUrl(r.certificate_url, 60);
    if (error || !data?.signedUrl) {
      toast({ title: "Gagal membuka sertifikat", description: error?.message, variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <GraduationCap className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Training & Sertifikasi</h1>
            <p className="text-sm text-muted-foreground">Kelola program training dan riwayat sertifikasi karyawan.</p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList>
            <TabsTrigger value="programs"><GraduationCap className="h-4 w-4 mr-1" /> Program</TabsTrigger>
            <TabsTrigger value="history"><Users className="h-4 w-4 mr-1" /> Riwayat Karyawan</TabsTrigger>
            <TabsTrigger value="expiring">
              <AlertTriangle className="h-4 w-4 mr-1" /> Kedaluwarsa
              {expiring.length > 0 && <Badge className="ml-2 bg-amber-500">{expiring.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          {/* PROGRAM */}
          <TabsContent value="programs" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Master Program Training</CardTitle>
                <Button size="sm" onClick={() => { resetProg(); setProgOpen(true); }}>
                  <Plus className="h-4 w-4 mr-1" /> Tambah Program
                </Button>
              </CardHeader>
              <CardContent>
                {loading ? <p className="text-center text-muted-foreground py-8">Memuat...</p>
                  : programs.length === 0 ? <p className="text-center text-muted-foreground py-8">Belum ada program.</p>
                  : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nama</TableHead>
                          <TableHead>Kategori</TableHead>
                          <TableHead>Penyelenggara</TableHead>
                          <TableHead className="text-right">Biaya</TableHead>
                          <TableHead>Durasi (jam)</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {programs.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">{p.name}</TableCell>
                            <TableCell>{p.category || "-"}</TableCell>
                            <TableCell>{p.provider || "-"}</TableCell>
                            <TableCell className="text-right">
                              {p.cost ? `Rp ${Number(p.cost).toLocaleString("id-ID")}` : "-"}
                            </TableCell>
                            <TableCell>{p.duration_hours ?? "-"}</TableCell>
                            <TableCell>
                              {p.is_active ? <Badge className="bg-emerald-600">Aktif</Badge> : <Badge variant="secondary">Nonaktif</Badge>}
                            </TableCell>
                            <TableCell className="text-right space-x-1">
                              <Button variant="ghost" size="icon" onClick={() => openEditProgram(p)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => deleteProgram(p)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* HISTORY */}
          <TabsContent value="history" className="mt-4">
            <Card>
              <CardHeader><CardTitle>Riwayat Training Semua Karyawan</CardTitle></CardHeader>
              <CardContent>
                {loading ? <p className="text-center text-muted-foreground py-8">Memuat...</p>
                  : history.length === 0 ? <p className="text-center text-muted-foreground py-8">Belum ada riwayat.</p>
                  : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Karyawan</TableHead>
                          <TableHead>Departemen</TableHead>
                          <TableHead>Training</TableHead>
                          <TableHead>Periode</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Skor</TableHead>
                          <TableHead>Kedaluwarsa</TableHead>
                          <TableHead className="text-right">Sertifikat</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {history.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">{r.profiles?.full_name || "-"}</TableCell>
                            <TableCell className="text-xs">{r.profiles?.departemen || "-"}</TableCell>
                            <TableCell>{r.training_name}</TableCell>
                            <TableCell className="text-xs">
                              {r.start_date ? new Date(r.start_date).toLocaleDateString("id-ID") : "-"}
                              {" → "}
                              {r.end_date ? new Date(r.end_date).toLocaleDateString("id-ID") : "-"}
                            </TableCell>
                            <TableCell>{statusBadge(r.status)}</TableCell>
                            <TableCell className="text-xs">{r.score ?? "-"}</TableCell>
                            <TableCell className="text-xs">
                              {r.expiry_date ? new Date(r.expiry_date).toLocaleDateString("id-ID") : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {r.certificate_url ? (
                                <Button variant="ghost" size="icon" onClick={() => downloadCert(r)}>
                                  <Download className="h-4 w-4" />
                                </Button>
                              ) : <span className="text-xs text-muted-foreground">-</span>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* EXPIRING */}
          <TabsContent value="expiring" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Sertifikasi Kedaluwarsa ≤ 60 Hari</CardTitle>
              </CardHeader>
              <CardContent>
                {expiring.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Tidak ada sertifikat yang mendekati kedaluwarsa.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Karyawan</TableHead>
                        <TableHead>Training</TableHead>
                        <TableHead>Tgl Kedaluwarsa</TableHead>
                        <TableHead>Sisa Hari</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expiring.map((r) => {
                        const d = daysUntil(r.expiry_date!);
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">{r.profiles?.full_name || "-"}</TableCell>
                            <TableCell>{r.training_name}</TableCell>
                            <TableCell>{new Date(r.expiry_date!).toLocaleDateString("id-ID")}</TableCell>
                            <TableCell>
                              {d < 0 ? <Badge variant="destructive">Kedaluwarsa {Math.abs(d)} hari</Badge>
                                : <Badge className="bg-amber-500">{d} hari lagi</Badge>}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Program dialog */}
        <Dialog open={progOpen} onOpenChange={(o) => { setProgOpen(o); if (!o) resetProg(); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{progEditId ? "Edit Program" : "Tambah Program"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Nama Program *</Label>
                <Input value={progForm.name} onChange={(e) => setProgForm({ ...progForm, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>Kategori</Label>
                  <Input value={progForm.category} onChange={(e) => setProgForm({ ...progForm, category: e.target.value })} placeholder="Contoh: K3, Soft Skill" />
                </div>
                <div className="space-y-2">
                  <Label>Penyelenggara</Label>
                  <Input value={progForm.provider} onChange={(e) => setProgForm({ ...progForm, provider: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>Biaya (Rp)</Label>
                  <Input type="number" value={progForm.cost} onChange={(e) => setProgForm({ ...progForm, cost: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Durasi (jam)</Label>
                  <Input type="number" step="0.5" value={progForm.duration_hours} onChange={(e) => setProgForm({ ...progForm, duration_hours: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Deskripsi</Label>
                <Textarea rows={3} value={progForm.description} onChange={(e) => setProgForm({ ...progForm, description: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={progForm.is_active} onChange={(e) => setProgForm({ ...progForm, is_active: e.target.checked })} />
                Aktif
              </label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setProgOpen(false)}>Batal</Button>
              <Button onClick={submitProgram}>Simpan</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Training;
