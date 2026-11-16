import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import logo from "@/assets/logo.png";

type Details = {
  client?: { name?: string; client_name?: string; redirect_uri?: string };
  redirect_uri?: string;
  scope?: string;
  scopes?: string[];
  redirect_url?: string;
  redirect_to?: string;
};
type Result = { data: Details | null; error: { message: string } | null };
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<Result>;
  approveAuthorization: (id: string) => Promise<Result>;
  denyAuthorization: (id: string) => Promise<Result>;
};

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const id = params.get("authorization_id") ?? "";
  const { user, profile, loading, signOut } = useAuth();
  const [details, setDetails] = useState<Details | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const oauth = (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

  useEffect(() => {
    let active = true;
    setDetails(null);
    setError("");
    if (!id) { setError("Permintaan koneksi tidak valid: ID persetujuan tidak tersedia."); return; }
    if (loading) return;
    if (!user) {
      window.location.assign("/login?next=" + encodeURIComponent(window.location.pathname + window.location.search + window.location.hash));
      return;
    }
    if (!profile || profile.status !== "Active") { setError("Koneksi membutuhkan akun karyawan aktif."); return; }
    (async () => {
      try {
        const { data, error: lookupError } = await oauth.getAuthorizationDetails(id);
        if (!active) return;
        if (lookupError || !data) throw new Error("lookup");
        const target = data.redirect_url ?? data.redirect_to;
        if (target && !data.client) { window.location.assign(target); return; }
        if (!data.client) throw new Error("client");
        setDetails(data);
      } catch {
        if (active) setError("Permintaan koneksi kedaluwarsa, tidak valid, atau belum dapat dimuat. Mulai kembali dari aplikasi agen.");
      }
    })();
    return () => { active = false; };
  }, [id, user?.id, loading, profile?.status, retry]);

  async function decide(approve: boolean) {
    if (busy || !details) return;
    setBusy(true);
    setError("");
    try {
      const { data, error: actionError } = approve ? await oauth.approveAuthorization(id) : await oauth.denyAuthorization(id);
      const target = data?.redirect_url ?? data?.redirect_to;
      if (actionError || !target) throw new Error("decision");
      window.location.assign(target);
    } catch {
      setError(approve ? "Persetujuan belum berhasil. Coba lagi atau batalkan koneksi." : "Pembatalan belum berhasil. Silakan coba lagi.");
      setBusy(false);
    }
  }

  const client = details?.client?.name ?? details?.client?.client_name ?? "aplikasi agen";
  const scopes = details?.scopes ?? details?.scope?.split(/\s+/).filter(Boolean) ?? [];
  const labels: Record<string, string> = { openid: "Identitas akun", email: "Alamat email", profile: "Profil dasar" };
  return <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
    <Card className="w-full max-w-lg">
      <CardHeader>
        <img src={logo} alt="Kemika" className="h-12 object-contain self-start mb-4" />
        <CardTitle>{details ? `Hubungkan ${client} ke HRIS Kemika` : "Koneksi ke HRIS Kemika"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {!details && !error && <p role="status">Memuat permintaan koneksi…</p>}
        {!details && error && id && <Button variant="outline" onClick={() => setRetry(value => value + 1)}>Coba lagi</Button>}
        {details && <>
          <p className="text-sm break-words">Akun: {user?.email}</p>
          <p className="text-sm">{client} dapat menggunakan alat aplikasi sebagai Anda.</p>
          <p className="text-sm break-all text-muted-foreground">Tujuan koneksi: {details.redirect_uri ?? details.client?.redirect_uri ?? "Ditentukan dalam permintaan koneksi"}</p>
          {scopes.length > 0 && <ul className="text-sm list-disc pl-5">{scopes.map(scope => <li key={scope}>{labels[scope] ?? `Izin tambahan: ${scope}`}</li>)}</ul>}
          <p className="text-sm">Akses aplikasi: membaca riwayat absensi Anda sendiri, tanpa foto, lokasi, catatan, atau data gaji.</p>
          <p className="text-sm text-muted-foreground">Hak akses aplikasi tetap berlaku. Koneksi ini tidak memberikan akses ke data karyawan lain.</p>
          <div className="flex flex-wrap gap-3">
            <Button disabled={busy} onClick={() => decide(true)}>{busy ? "Memproses…" : "Setujui koneksi"}</Button>
            <Button variant="outline" disabled={busy} onClick={() => decide(false)}>Batalkan koneksi</Button>
          </div>
          <Button variant="link" disabled={busy} onClick={() => signOut()}>Gunakan akun lain</Button>
        </>}
      </CardContent>
    </Card>
  </main>;
}