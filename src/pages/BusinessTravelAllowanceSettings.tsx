import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Loader2, Save, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TravelAllowanceConfig {
  per_day_amount: number;
  enabled: boolean;
}

const DEFAULT_CONFIG: TravelAllowanceConfig = { per_day_amount: 100000, enabled: true };

export default function BusinessTravelAllowanceSettings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<TravelAllowanceConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from("system_settings").select("value")
          .eq("key", "business_travel_allowance_config").maybeSingle();
        if (data?.value) setConfig({ ...DEFAULT_CONFIG, ...(data.value as any) });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("system_settings").select("id")
        .eq("key", "business_travel_allowance_config").maybeSingle();
      if (existing) {
        await supabase.from("system_settings")
          .update({ value: config as any, updated_at: new Date().toISOString() })
          .eq("key", "business_travel_allowance_config");
      } else {
        await supabase.from("system_settings").insert({
          key: "business_travel_allowance_config",
          value: config as any,
          description: "Konfigurasi tunjangan perjalanan dinas",
        });
      }
      toast.success("Pengaturan tunjangan perjalanan dinas disimpan");
    } catch (e: any) {
      toast.error("Gagal menyimpan pengaturan");
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fadeIn">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/settings")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Tunjangan Perjalanan Dinas</h1>
            <p className="text-muted-foreground text-sm">Konfigurasi nilai tunjangan per hari untuk perjalanan dinas</p>
          </div>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Formula:</strong> Tambahan = max(0, <em>Nilai Dinas/Hari</em> − <em>Tunj. Kehadiran/Hari</em>) × <em>Hari Dinas Efektif</em>.
            <br />Hari dinas efektif mengabaikan akhir pekan dan hari libur nasional. Tunj. kehadiran per hari dihitung dari pengaturan "Tunjangan Kehadiran" dibagi jumlah hari kerja bulan tersebut.
            <br />Nilai otomatis ditambahkan ke <strong>payroll bulan saat dinas dimulai</strong> ketika pengajuan dinas di-approve.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Pengaturan Umum</CardTitle>
            <CardDescription>Nilai flat tunjangan dinas per hari</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Aktifkan Tunjangan Perjalanan Dinas</Label>
                <p className="text-xs text-muted-foreground">Saat dimatikan, approval dinas tidak menambah ke payroll.</p>
              </div>
              <Switch
                checked={config.enabled}
                onCheckedChange={(checked) => setConfig((p) => ({ ...p, enabled: checked }))}
              />
            </div>

            <div className="space-y-2 max-w-xs">
              <Label>Nilai Tunjangan per Hari</Label>
              <Input
                type="number"
                value={config.per_day_amount}
                onChange={(e) => setConfig((p) => ({ ...p, per_day_amount: Number(e.target.value) || 0 }))}
              />
              <p className="text-xs text-muted-foreground">{formatCurrency(config.per_day_amount)} / hari</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => navigate("/dashboard/settings")}>Batal</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Simpan Pengaturan
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
