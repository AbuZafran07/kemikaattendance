import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DoorOpen, ClipboardList, Save, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const DEFAULT_CHECKLIST = [
  "Serah terima laptop / aset perusahaan",
  "Serah terima HP / SIM card kantor",
  "Return kartu akses / ID card",
  "Handover akun email & sistem internal",
  "Handover pekerjaan / knowledge transfer",
  "Serah terima dokumen aktif",
  "Penyelesaian pinjaman karyawan",
  "Penonaktifan BPJS Kesehatan / Ketenagakerjaan",
  "Surat pengalaman kerja / paklaring",
];

const REASONS = ["Karir lebih baik", "Gaji/benefit", "Kondisi kerja", "Personal/Keluarga", "Pindah domisili", "Studi lanjut", "Lainnya"];
const RATING_KEYS = [
  { k: "management", label: "Manajemen" },
  { k: "culture", label: "Budaya kerja" },
  { k: "compensation", label: "Kompensasi" },
  { k: "career_growth", label: "Peluang karir" },
  { k: "work_life", label: "Work-life balance" },
];

export default function ExitManagement() {
  const { toast } = useToast();
  const [tab, setTab] = useState("exit");
  const [resigned, setResigned] = useState<any[]>([]);
  const [exits, setExits] = useState<any[]>([]);
  const [handovers, setHandovers] = useState<any[]>([]);

  const [exitDialog, setExitDialog] = useState(false);
  const [handoverDialog, setHandoverDialog] = useState(false);
  const [target, setTarget] = useState<any>(null);

  const [exitForm, setExitForm] = useState<any>({
    interview_date: new Date().toISOString().slice(0, 10),
    reason: "", reason_detail: "", suggestions: "", would_recommend: true,
    satisfaction: RATING_KEYS.reduce((acc: any, r) => ({ ...acc, [r.k]: 3 }), {}),
  });
  const [hoForm, setHoForm] = useState<any>({
    items: DEFAULT_CHECKLIST.map((label) => ({ label, done: false })),
    notes: "",
  });

  const fetchAll = async () => {
    const [{ data: emp }, { data: ei }, { data: ho }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, jabatan, departemen, status, resign_date").in("status", ["Resigned", "Inactive"]).order("resign_date", { ascending: false }),
      supabase.from("exit_interviews" as any).select("*"),
      supabase.from("handover_checklists" as any).select("*"),
    ]);
    setResigned(emp || []);
    setExits(((ei as any[]) || []));
    setHandovers(((ho as any[]) || []));
  };
  useEffect(() => { fetchAll(); }, []);

  const exitMap = useMemo(() => Object.fromEntries(exits.map((e) => [e.employee_id, e])), [exits]);
  const hoMap = useMemo(() => Object.fromEntries(handovers.map((e) => [e.employee_id, e])), [handovers]);

  const openExitDialog = (emp: any) => {
    setTarget(emp);
    const existing = exitMap[emp.id];
    if (existing) {
      setExitForm({
        interview_date: existing.interview_date || new Date().toISOString().slice(0, 10),
        reason: existing.reason || "",
        reason_detail: existing.reason_detail || "",
        suggestions: existing.suggestions || "",
        would_recommend: existing.would_recommend ?? true,
        satisfaction: { ...RATING_KEYS.reduce((a: any, r) => ({ ...a, [r.k]: 3 }), {}), ...(existing.satisfaction || {}) },
      });
    } else {
      setExitForm({
        interview_date: new Date().toISOString().slice(0, 10),
        reason: "", reason_detail: "", suggestions: "", would_recommend: true,
        satisfaction: RATING_KEYS.reduce((acc: any, r) => ({ ...acc, [r.k]: 3 }), {}),
      });
    }
    setExitDialog(true);
  };

  const openHandoverDialog = (emp: any) => {
    setTarget(emp);
    const existing = hoMap[emp.id];
    if (existing) {
      setHoForm({
        items: Array.isArray(existing.items) && existing.items.length
          ? existing.items
          : DEFAULT_CHECKLIST.map((label) => ({ label, done: false })),
        notes: existing.notes || "",
      });
    } else {
      setHoForm({
        items: DEFAULT_CHECKLIST.map((label) => ({ label, done: false })),
        notes: "",
      });
    }
    setHandoverDialog(true);
  };

  const saveExit = async () => {
    if (!target) return;
    const { data: { user } } = await supabase.auth.getUser();
    const payload: any = {
      employee_id: target.id,
      interview_date: exitForm.interview_date,
      reason: exitForm.reason || null,
      reason_detail: exitForm.reason_detail || null,
      suggestions: exitForm.suggestions || null,
      would_recommend: !!exitForm.would_recommend,
      satisfaction: exitForm.satisfaction,
      interviewer: user?.id,
    };
    const existing = exitMap[target.id];
    const q = existing
      ? supabase.from("exit_interviews" as any).update(payload).eq("id", existing.id)
      : supabase.from("exit_interviews" as any).insert(payload);
    const { error } = await q;
    if (error) { toast({ title: "Gagal menyimpan", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Exit interview tersimpan" });
    setExitDialog(false); fetchAll();
  };

  const saveHandover = async (markComplete = false) => {
    if (!target) return;
    const { data: { user } } = await supabase.auth.getUser();
    const allDone = hoForm.items.every((i: any) => i.done);
    const status = markComplete ? (allDone ? "completed" : "in_progress") : "in_progress";
    const payload: any = {
      employee_id: target.id,
      items: hoForm.items,
      notes: hoForm.notes || null,
      status,
      verified_by: markComplete && allDone ? user?.id : null,
      verified_at: markComplete && allDone ? new Date().toISOString() : null,
    };
    const existing = hoMap[target.id];
    const q = existing
      ? supabase.from("handover_checklists" as any).update(payload).eq("id", existing.id)
      : supabase.from("handover_checklists" as any).insert(payload);
    const { error } = await q;
    if (error) { toast({ title: "Gagal menyimpan", description: error.message, variant: "destructive" }); return; }
    toast({ title: markComplete ? (allDone ? "Handover diverifikasi" : "Belum semua item selesai") : "Checklist tersimpan" });
    setHandoverDialog(false); fetchAll();
  };

  const renderEmployeeRow = (emp: any) => {
    const ei = exitMap[emp.id];
    const ho = hoMap[emp.id];
    const hoProgress = ho?.items ? `${ho.items.filter((i: any) => i.done).length}/${ho.items.length}` : "-";
    return (
      <TableRow key={emp.id}>
        <TableCell>{emp.full_name}<div className="text-xs text-muted-foreground">{emp.jabatan} · {emp.departemen}</div></TableCell>
        <TableCell>{emp.resign_date ? new Date(emp.resign_date).toLocaleDateString("id-ID") : "-"}</TableCell>
        <TableCell>
          {ei ? <Badge>Sudah diisi</Badge> : <Badge variant="outline">Belum</Badge>}
        </TableCell>
        <TableCell>
          {ho
            ? <Badge variant={ho.status === "completed" ? "default" : "secondary"}>{ho.status} · {hoProgress}</Badge>
            : <Badge variant="outline">Belum</Badge>}
        </TableCell>
        <TableCell className="text-right space-x-1">
          <Button size="sm" variant="outline" onClick={() => openExitDialog(emp)}>Exit Interview</Button>
          <Button size="sm" variant="outline" onClick={() => openHandoverDialog(emp)}>Handover</Button>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><DoorOpen className="h-6 w-6" /> Exit Management</h1>
          <p className="text-sm text-muted-foreground">Kelola exit interview & handover checklist karyawan resign.</p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="exit"><DoorOpen className="h-4 w-4 mr-1" /> Exit Interview</TabsTrigger>
            <TabsTrigger value="handover"><ClipboardList className="h-4 w-4 mr-1" /> Handover Checklist</TabsTrigger>
          </TabsList>

          <TabsContent value="exit" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Karyawan Resigned / Inactive ({resigned.length})</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Karyawan</TableHead><TableHead>Tgl Resign</TableHead>
                    <TableHead>Exit Interview</TableHead><TableHead>Handover</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {resigned.map(renderEmployeeRow)}
                    {resigned.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Belum ada karyawan resign.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="handover" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Ringkasan Handover</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Karyawan</TableHead><TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead><TableHead>Diverifikasi</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {resigned.map((emp) => {
                      const ho = hoMap[emp.id];
                      const done = ho?.items ? ho.items.filter((i: any) => i.done).length : 0;
                      const total = ho?.items?.length || 0;
                      return (
                        <TableRow key={emp.id}>
                          <TableCell>{emp.full_name}</TableCell>
                          <TableCell>{ho ? <Badge variant={ho.status === "completed" ? "default" : "secondary"}>{ho.status}</Badge> : <Badge variant="outline">Belum dibuat</Badge>}</TableCell>
                          <TableCell>{total > 0 ? `${done}/${total}` : "-"}</TableCell>
                          <TableCell>{ho?.verified_at ? new Date(ho.verified_at).toLocaleDateString("id-ID") : "-"}</TableCell>
                          <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => openHandoverDialog(emp)}>Kelola</Button></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Exit Interview Dialog */}
      <Dialog open={exitDialog} onOpenChange={setExitDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Exit Interview — {target?.full_name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Tanggal Interview</Label>
                <Input type="date" value={exitForm.interview_date} onChange={(e) => setExitForm({ ...exitForm, interview_date: e.target.value })} />
              </div>
              <div className="space-y-1"><Label>Alasan Utama</Label>
                <Select value={exitForm.reason} onValueChange={(v) => setExitForm({ ...exitForm, reason: v })}>
                  <SelectTrigger><SelectValue placeholder="Pilih alasan" /></SelectTrigger>
                  <SelectContent>{REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1"><Label>Detail Alasan</Label>
              <Textarea rows={2} value={exitForm.reason_detail} onChange={(e) => setExitForm({ ...exitForm, reason_detail: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Rating Kepuasan (1 = sangat buruk, 5 = sangat baik)</Label>
              {RATING_KEYS.map((r) => (
                <div key={r.k} className="flex items-center gap-3">
                  <div className="w-40 text-sm">{r.label}</div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Button key={n} size="sm" variant={exitForm.satisfaction[r.k] === n ? "default" : "outline"}
                        onClick={() => setExitForm({ ...exitForm, satisfaction: { ...exitForm.satisfaction, [r.k]: n } })}>
                        {n}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-1"><Label>Saran untuk perusahaan</Label>
              <Textarea rows={3} value={exitForm.suggestions} onChange={(e) => setExitForm({ ...exitForm, suggestions: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={exitForm.would_recommend} onCheckedChange={(v) => setExitForm({ ...exitForm, would_recommend: !!v })} />
              <Label className="cursor-pointer">Bersedia merekomendasikan perusahaan ke teman/kolega</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExitDialog(false)}>Batal</Button>
            <Button onClick={saveExit}><Save className="h-4 w-4 mr-1" /> Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Handover Dialog */}
      <Dialog open={handoverDialog} onOpenChange={setHandoverDialog}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Handover Checklist — {target?.full_name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {hoForm.items.map((it: any, idx: number) => (
              <div key={idx} className="flex items-start gap-2 border rounded-md p-2">
                <Checkbox checked={it.done} onCheckedChange={(v) => {
                  const next = [...hoForm.items]; next[idx] = { ...it, done: !!v };
                  setHoForm({ ...hoForm, items: next });
                }} />
                <Input value={it.label} onChange={(e) => {
                  const next = [...hoForm.items]; next[idx] = { ...it, label: e.target.value };
                  setHoForm({ ...hoForm, items: next });
                }} className="flex-1" />
                <Button size="sm" variant="ghost" onClick={() => {
                  setHoForm({ ...hoForm, items: hoForm.items.filter((_: any, i: number) => i !== idx) });
                }}>×</Button>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => setHoForm({ ...hoForm, items: [...hoForm.items, { label: "", done: false }] })}>
              + Tambah Item
            </Button>
            <div className="space-y-1"><Label>Catatan</Label>
              <Textarea rows={2} value={hoForm.notes} onChange={(e) => setHoForm({ ...hoForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHandoverDialog(false)}>Batal</Button>
            <Button variant="outline" onClick={() => saveHandover(false)}><Save className="h-4 w-4 mr-1" /> Simpan</Button>
            <Button onClick={() => saveHandover(true)}><CheckCircle2 className="h-4 w-4 mr-1" /> Verifikasi Selesai</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
