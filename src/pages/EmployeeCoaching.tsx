import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Lock, FileText, CheckCircle2, XCircle, Unlock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import ApprovalReasonDialog from "@/components/ApprovalReasonDialog";
import { getUnlockLetterSignedUrl } from "@/lib/unlockLetterStorage";
import { pushRecentAttendanceNotifications, nowMinusBuffer } from "@/lib/attendanceDisciplineNotifications";
import logger from "@/lib/logger";

interface LockedRow {
  lock_id: string;
  user_id: string;
  full_name: string;
  departemen: string;
  photo_url: string | null;
  locked_at: string;
  violation_count_at_lock: number;
  coaching: { id: string; status: string } | null;
  unlockLetter: { id: string; status: string; document_url: string | null; rejection_reason: string | null } | null;
}

const EmployeeCoaching = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [rows, setRows] = useState<LockedRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<LockedRow | null>(null);

  const [coachingType, setCoachingType] = useState("");
  const [coachingNotes, setCoachingNotes] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [savingCoaching, setSavingCoaching] = useState(false);
  const [completingCoaching, setCompletingCoaching] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [signedPdfUrl, setSignedPdfUrl] = useState<string | null>(null);

  const fetchLockedAccounts = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: locks, error } = await supabase
        .from("account_locks")
        .select("id, user_id, locked_at, violation_count_at_lock")
        .eq("status", "locked")
        .order("locked_at", { ascending: false });
      if (error) throw error;

      if (!locks || locks.length === 0) {
        setRows([]);
        return;
      }

      const lockIds = locks.map((l) => l.id);
      const userIds = [...new Set(locks.map((l) => l.user_id))];

      const [{ data: profiles }, { data: coachings }, { data: letters }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, departemen, photo_url").in("id", userIds),
        supabase
          .from("employee_coaching")
          .select("id, related_lock_id, status, coaching_date")
          .in("related_lock_id", lockIds)
          .order("coaching_date", { ascending: false }),
        supabase
          .from("account_unlock_letters")
          .select("id, lock_id, status, document_url, rejection_reason, created_at")
          .in("lock_id", lockIds)
          .order("created_at", { ascending: false }),
      ]);

      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
      const coachingByLock = new Map<string, { id: string; status: string }>();
      (coachings || []).forEach((c) => {
        if (!coachingByLock.has(c.related_lock_id)) {
          coachingByLock.set(c.related_lock_id, { id: c.id, status: c.status });
        }
      });
      const letterByLock = new Map<
        string,
        { id: string; status: string; document_url: string | null; rejection_reason: string | null }
      >();
      (letters || []).forEach((l) => {
        if (!letterByLock.has(l.lock_id)) {
          letterByLock.set(l.lock_id, {
            id: l.id,
            status: l.status,
            document_url: l.document_url,
            rejection_reason: l.rejection_reason,
          });
        }
      });

      setRows(
        locks.map((l) => {
          const profile = profileMap.get(l.user_id);
          return {
            lock_id: l.id,
            user_id: l.user_id,
            full_name: profile?.full_name || "Unknown",
            departemen: profile?.departemen || "-",
            photo_url: profile?.photo_url || null,
            locked_at: l.locked_at,
            violation_count_at_lock: l.violation_count_at_lock,
            coaching: coachingByLock.get(l.id) || null,
            unlockLetter: letterByLock.get(l.id) || null,
          };
        })
      );
    } catch (error) {
      logger.error("Error fetching locked accounts:", error);
      toast({
        title: "Gagal Memuat Data",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchLockedAccounts();
  }, [fetchLockedAccounts]);

  const openDetail = async (row: LockedRow) => {
    setSelected(row);
    setCoachingType("");
    setCoachingNotes("");
    setFollowUp("");
    setSignedPdfUrl(null);
    if (row.unlockLetter?.document_url) {
      const url = await getUnlockLetterSignedUrl(row.unlockLetter.document_url);
      setSignedPdfUrl(url);
    }
  };

  const handleCreateCoaching = async () => {
    if (!selected || !user) return;
    if (!coachingNotes.trim()) {
      toast({ title: "Catatan pembinaan wajib diisi", variant: "destructive" });
      return;
    }
    setSavingCoaching(true);
    try {
      const { error } = await supabase.from("employee_coaching").insert({
        user_id: selected.user_id,
        related_lock_id: selected.lock_id,
        violation_count: selected.violation_count_at_lock,
        coaching_type: coachingType || null,
        coaching_notes: coachingNotes.trim(),
        follow_up: followUp.trim() || null,
        hr_pic: user.id,
        status: "scheduled",
      });
      if (error) throw error;
      toast({ title: "Berhasil", description: "Pembinaan berhasil dijadwalkan." });
      await fetchLockedAccounts();
      setSelected(null);
    } catch (error) {
      toast({
        title: "Gagal",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setSavingCoaching(false);
    }
  };

  const handleCompleteCoaching = async () => {
    if (!selected?.coaching) return;
    setCompletingCoaching(true);
    try {
      const { error } = await supabase
        .from("employee_coaching")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", selected.coaching.id);
      if (error) throw error;
      toast({ title: "Berhasil", description: "Pembinaan ditandai selesai." });
      await fetchLockedAccounts();
      setSelected(null);
    } catch (error) {
      toast({
        title: "Gagal",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setCompletingCoaching(false);
    }
  };

  const handleApproveLetter = async () => {
    if (!selected?.unlockLetter) return;
    const since = nowMinusBuffer();
    const { error } = await (supabase.rpc as any)("approve_unlock_letter", { p_letter_id: selected.unlockLetter.id });
    if (error) {
      toast({ title: "Gagal Menyetujui", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Berhasil", description: "Surat unlock disetujui." });
    await fetchLockedAccounts();
    setSelected(null);
    pushRecentAttendanceNotifications(since);
  };

  const handleRejectLetter = async (reason: string) => {
    if (!selected?.unlockLetter) return;
    const since = nowMinusBuffer();
    const { error } = await (supabase.rpc as any)("reject_unlock_letter", {
      p_letter_id: selected.unlockLetter.id,
      p_reason: reason,
    });
    if (error) {
      toast({ title: "Gagal Menolak", description: error.message, variant: "destructive" });
      throw error;
    }
    toast({ title: "Berhasil", description: "Surat unlock ditolak." });
    await fetchLockedAccounts();
    setSelected(null);
    pushRecentAttendanceNotifications(since);
  };

  const handleUnlock = async () => {
    if (!selected?.coaching || !selected?.unlockLetter) return;
    setUnlocking(true);
    const since = nowMinusBuffer();
    try {
      const { error } = await (supabase.rpc as any)("unlock_account", {
        p_lock_id: selected.lock_id,
        p_coaching_id: selected.coaching.id,
        p_unlock_letter_id: selected.unlockLetter.id,
      });
      if (error) throw error;
      toast({ title: "Berhasil", description: "Akun karyawan berhasil dibuka kembali." });
      await fetchLockedAccounts();
      setSelected(null);
      pushRecentAttendanceNotifications(since);
    } catch (error) {
      toast({
        title: "Gagal Unlock",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setUnlocking(false);
    }
  };

  const canUnlock = selected?.coaching?.status === "completed" && selected?.unlockLetter?.status === "approved";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/attendance-discipline")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Pembinaan Karyawan</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Kelola pembinaan dan proses pembukaan lock akun karyawan yang terkunci.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Akun Terkunci</CardTitle>
            <CardDescription>{rows.length} akun sedang terkunci</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Memuat data...</div>
            ) : rows.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Tidak ada akun yang terkunci</div>
            ) : (
              <div className="space-y-3">
                {rows.map((row) => (
                  <div
                    key={row.lock_id}
                    className="flex items-center justify-between border border-border rounded-lg p-3 cursor-pointer hover:bg-accent/40"
                    onClick={() => openDetail(row)}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={row.photo_url || undefined} />
                        <AvatarFallback>{row.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{row.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.departemen} • Terkunci sejak{" "}
                          {new Date(row.locked_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}{" "}
                          • {row.violation_count_at_lock} pelanggaran
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!row.coaching && <Badge variant="secondary">Belum Dibina</Badge>}
                      {row.coaching?.status === "scheduled" && <Badge variant="secondary">Pembinaan Berjalan</Badge>}
                      {row.coaching?.status === "completed" && <Badge>Pembinaan Selesai</Badge>}
                      {row.unlockLetter?.status === "submitted" && <Badge variant="secondary">Surat Menunggu</Badge>}
                      {row.unlockLetter?.status === "approved" && <Badge>Surat Disetujui</Badge>}
                      <Lock className="h-4 w-4 text-destructive" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.full_name}</DialogTitle>
                <DialogDescription>
                  {selected.departemen} • {selected.violation_count_at_lock} pelanggaran saat dikunci
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5">
                {/* Coaching section */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Pembinaan</Label>
                  {!selected.coaching ? (
                    <div className="space-y-2 border border-border rounded-lg p-3">
                      <Input placeholder="Jenis pembinaan (opsional)" value={coachingType} onChange={(e) => setCoachingType(e.target.value)} />
                      <Textarea placeholder="Catatan pembinaan *" value={coachingNotes} onChange={(e) => setCoachingNotes(e.target.value)} rows={3} />
                      <Textarea placeholder="Tindak lanjut (opsional)" value={followUp} onChange={(e) => setFollowUp(e.target.value)} rows={2} />
                      <Button size="sm" onClick={handleCreateCoaching} disabled={savingCoaching || !coachingNotes.trim()}>
                        {savingCoaching && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                        Jadwalkan Pembinaan
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between border border-border rounded-lg p-3">
                      <Badge variant={selected.coaching.status === "completed" ? "default" : "secondary"}>
                        {selected.coaching.status === "completed" ? "Selesai" : "Berjalan"}
                      </Badge>
                      {selected.coaching.status !== "completed" && (
                        <Button size="sm" variant="outline" onClick={handleCompleteCoaching} disabled={completingCoaching}>
                          {completingCoaching && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                          Tandai Selesai
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Unlock letter section */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Surat Permohonan Unlock</Label>
                  {!selected.unlockLetter ? (
                    <p className="text-sm text-muted-foreground">Karyawan belum mengajukan surat.</p>
                  ) : (
                    <div className="space-y-2 border border-border rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <Badge
                          variant={
                            selected.unlockLetter.status === "approved"
                              ? "default"
                              : selected.unlockLetter.status === "rejected"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {selected.unlockLetter.status === "approved"
                            ? "Disetujui"
                            : selected.unlockLetter.status === "rejected"
                            ? "Ditolak"
                            : "Menunggu Persetujuan"}
                        </Badge>
                        {signedPdfUrl && (
                          <a href={signedPdfUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline flex items-center gap-1">
                            <FileText className="h-3.5 w-3.5" /> Lihat PDF
                          </a>
                        )}
                      </div>
                      {selected.unlockLetter.status === "rejected" && selected.unlockLetter.rejection_reason && (
                        <p className="text-xs text-destructive">Alasan: {selected.unlockLetter.rejection_reason}</p>
                      )}
                      {selected.unlockLetter.status === "submitted" && (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleApproveLetter}>
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Setujui
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => setRejectDialogOpen(true)}>
                            <XCircle className="h-3.5 w-3.5 mr-1" /> Tolak
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelected(null)}>
                  Tutup
                </Button>
                <Button onClick={handleUnlock} disabled={!canUnlock || unlocking}>
                  {unlocking ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Unlock className="h-4 w-4 mr-2" />}
                  Unlock Account
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ApprovalReasonDialog
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
        action="reject"
        title="Surat Permohonan Unlock"
        onConfirm={handleRejectLetter}
      />
    </DashboardLayout>
  );
};

export default EmployeeCoaching;
