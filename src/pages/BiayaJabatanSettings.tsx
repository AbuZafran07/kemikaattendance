
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, Loader2, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatRupiah } from "@/lib/payrollCalculation";

export interface BiayaJabatanConfig {
  rate_percent: number;       // e.g. 5
  max_yearly: number;         // e.g. 6000000
}

export const DEFAULT_BIAYA_JABATAN_CONFIG: BiayaJabatanConfig = {
  rate_percent: 5,
  max_yearly: 6000000,
};

export default function BiayaJabatanSettings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [config, setConfig] = useState<BiayaJabatanConfig>(DEFAULT_BIAYA_JABATAN_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "biaya_jabatan_config")
        .maybeSingle();

      if (data?.value) {
        const val = data.value as Record<string, unknown>;
        setConfig({
          rate_percent: Number(val.rate_percent) || DEFAULT_BIAYA_JABATAN_CONFIG.rate_percent,
          max_yearly: Number(val.max_yearly) || DEFAULT_BIAYA_JABATAN_CONFIG.max_yearly,
        });
      }
    } catch (error) {
      console.error("Error fetching biaya jabatan config:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("system_settings")
        .select("id")
        .eq("key", "biaya_jabatan_config")
        .maybeSingle();

      if (existing) {
        await supabase
          .from("system_settings")
          .update({ value: config as any, updated_at: new Date().toISOString() })
          .eq("key", "biaya_jabatan_config");
      } else {
        await supabase
          .from("system_settings")
          .insert({ key: "biaya_jabatan_config", value: config as any, description: "Konfigurasi Biaya Jabatan" });
      }

      toast({ title: "Berhasil", description: "Pengaturan Biaya Jabatan berhasil disimpan." });
    } catch (error: any) {
      toast({ title: "Gagal", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const maxMonthly = Math.round(config.max_yearly / 12);

  // Simulation
  const simSalary = 10000000;
  const simBiayaJabatan = Math.min(simSalary * (config.rate_percent / 100), maxMonthly);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6 animate-fadeIn max-w-2xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/settings")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Pengaturan Biaya Jabatan</h1>
            <p className="text-sm text-muted-foreground mt-1">Konfigurasi tarif dan batas maksimal biaya jabatan untuk perhitungan PPh 21</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Parameter Biaya Jabatan</CardTitle>
            <CardDescription>Sesuaikan dengan peraturan perpajakan yang berlaku</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tarif Biaya Jabatan (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={config.rate_percent}
                  onChange={(e) => setConfig({ ...config, rate_percent: Number(e.target.value) || 0 })}
                />
                <p className="text-xs text-muted-foreground">Regulasi saat ini: 5%</p>
              </div>
              <div className="space-y-2">
                <Label>Maksimal per Tahun (Rp)</Label>
                <Input
                  type="number"
                  step="100000"
                  min="0"
                  value={config.max_yearly}
                  onChange={(e) => setConfig({ ...config, max_yearly: Number(e.target.value) || 0 })}
                />
                <p className="text-xs text-muted-foreground">Regulasi saat ini: Rp 6.000.000/tahun</p>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Info className="h-4 w-4 text-primary" />
                Ringkasan
              </div>
              <div className="grid gap-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tarif</span>
                  <span className="font-medium">{config.rate_percent}% dari Bruto</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Maks. per Tahun</span>
                  <span className="font-medium">{formatRupiah(config.max_yearly)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Maks. per Bulan</span>
                  <span className="font-medium">{formatRupiah(maxMonthly)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Simulasi Perhitungan</CardTitle>
            <CardDescription>Contoh dengan gaji bruto {formatRupiah(simSalary)}/bulan</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bruto Bulanan</span>
                <span>{formatRupiah(simSalary)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Biaya Jabatan ({config.rate_percent}%)</span>
                <span>{formatRupiah(simSalary * (config.rate_percent / 100))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Maks. per Bulan</span>
                <span>{formatRupiah(maxMonthly)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 font-medium">
                <span>Biaya Jabatan Efektif</span>
                <span>{formatRupiah(simBiayaJabatan)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate("/dashboard/settings")}>Batal</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Simpan Pengaturan
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
