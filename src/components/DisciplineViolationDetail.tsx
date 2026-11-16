import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export default function DisciplineViolationDetail({ userId, month, onCorrected }: { userId: string; month: string; onCorrected: () => void }) {
  const [rows, setRows] = useState<Tables<"attendance_violations">[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const { toast } = useToast();
  const load = async () => {
    const { data, error } = await supabase.from("attendance_violations").select("*").eq("user_id", userId).gte("violation_date", `${month}-01`).lt("violation_date", `${Number(month.slice(0, 4)) + (month.endsWith("12") ? 1 : 0)}-${month.endsWith("12") ? "01" : String(Number(month.slice(5)) + 1).padStart(2, "0")}-01`).order("violation_date", { ascending: false });
    if (error) toast({ title: "Gagal memuat pelanggaran", variant: "destructive" });
    else setRows(data || []);
  };
  useEffect(() => {
    void load();
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
      setAllowed(Boolean(roles?.some(r => r.role === "admin" || r.role === "hr")));
    });
  }, [userId, month]);
  const waive = async () => {
    if (!selected || !note.trim() || busy) return;
    setBusy(true);
    const { error } = await supabase.rpc("waive_attendance_violation", { p_violation_id: selected, p_note: note.trim() });
    setBusy(false);
    if (error) { toast({ title: "Koreksi gagal", description: error.message, variant: "destructive" }); return; }
    setSelected(null); setNote(""); await load(); onCorrected();
    toast({ title: "Pelanggaran dikoreksi", description: "Catatan tersimpan; SP dan kunci otomatis dihitung ulang." });
  };
  return <div className="space-y-4">
    {rows.length === 0 && <p className="text-sm text-muted-foreground">Tidak ada pelanggaran pada bulan ini.</p>}
    {rows.map(row => <div key={row.id} className="border-b border-border pb-3 space-y-2">
      <div className="flex justify-between gap-2"><span>{row.violation_date}</span><Badge variant={row.is_counted ? "destructive" : "secondary"}>{row.is_counted ? "Dihitung" : "Tidak dihitung"}</Badge></div>
      <p className="text-sm break-words">{row.description || row.violation_type}</p>
      {allowed && row.is_counted && <Button variant="outline" size="sm" disabled={busy} onClick={() => { setSelected(row.id); setNote(""); }}>Koreksi Pelanggaran</Button>}
      {selected === row.id && <div className="space-y-2"><Label htmlFor="waiver-note">Catatan koreksi (wajib)</Label><Textarea id="waiver-note" value={note} onChange={e => setNote(e.target.value)} maxLength={1000} disabled={busy} /><div className="flex gap-2"><Button disabled={!note.trim() || busy} onClick={waive}>Simpan Koreksi</Button><Button variant="ghost" disabled={busy} onClick={() => setSelected(null)}>Batal</Button></div></div>}
    </div>)}
  </div>;
}