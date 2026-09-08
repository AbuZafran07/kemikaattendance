import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, FileSignature, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import UnlockLetterDialog from "@/components/UnlockLetterDialog";

interface AccountLockedCardProps {
  userId: string;
}

interface LockInfo {
  id: string;
  latestLetterStatus: string | null;
}

const AccountLockedCard = ({ userId }: AccountLockedCardProps) => {
  const [lockInfo, setLockInfo] = useState<LockInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchLockInfo = useCallback(async () => {
    setIsLoading(true);
    const { data: lock } = await supabase
      .from("account_locks")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "locked")
      .order("locked_at", { ascending: false })
      .maybeSingle();

    if (!lock) {
      setLockInfo(null);
      setIsLoading(false);
      return;
    }

    const { data: letter } = await supabase
      .from("account_unlock_letters")
      .select("status")
      .eq("lock_id", lock.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setLockInfo({ id: lock.id, latestLetterStatus: letter?.status || null });
    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchLockInfo();
  }, [fetchLockInfo]);

  const canSubmit = !lockInfo?.latestLetterStatus || lockInfo.latestLetterStatus === "rejected";

  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardContent className="pt-6 space-y-4 text-center">
        <div className="flex flex-col items-center gap-2">
          <div className="p-3 rounded-full bg-destructive/10">
            <Lock className="h-8 w-8 text-destructive" />
          </div>
          <h3 className="font-semibold text-lg">Account Locked</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Akun absensi Anda sementara dikunci karena telah melewati batas pelanggaran absensi. Silakan menghubungi
            HR untuk proses pembinaan.
          </p>
        </div>

        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
        ) : lockInfo ? (
          <div className="space-y-3">
            {lockInfo.latestLetterStatus === "submitted" && (
              <Badge variant="secondary">Surat Menunggu Persetujuan HR</Badge>
            )}
            {lockInfo.latestLetterStatus === "approved" && (
              <Badge>Surat Disetujui — Menunggu Proses Unlock oleh HR</Badge>
            )}
            {lockInfo.latestLetterStatus === "rejected" && (
              <Badge variant="destructive">Surat Sebelumnya Ditolak — Silakan Ajukan Ulang</Badge>
            )}

            {canSubmit && (
              <Button onClick={() => setDialogOpen(true)} className="w-full">
                <FileSignature className="h-4 w-4 mr-2" />
                Ajukan Pembukaan Lock
              </Button>
            )}

            <UnlockLetterDialog
              open={dialogOpen}
              onOpenChange={setDialogOpen}
              lockId={lockInfo.id}
              onSubmitted={fetchLockInfo}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default AccountLockedCard;
