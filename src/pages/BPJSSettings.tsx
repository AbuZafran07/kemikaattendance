
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Loader2, Info, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface BPJSConfig {
  // Kesehatan
  kes_employee_rate: number;   // default 1%
  kes_employer_rate: number;   // default 4%
  kes_max_salary: number;      // default 12.000.000

  // JHT
  jht_employee_rate: number;   // default 2%
  jht_employer_rate: number;   // default 3.7%

  // JP
  jp_employee_rate: number;    // default 1%
  jp_employer_rate: number;    // default 2%
  jp_max_salary: number;       // default 10.547.400

  // JKK
  jkk_employer_rate: number;   // default 0.24%

  // JKM
  jkm_employer_rate: number;   // default 0.3%
}

export const DEFAULT_BPJS_CONFIG: BPJSConfig = {
  kes_employee_rate: 1,
  kes_employer_rate: 4,
  kes_max_salary: 12000000,
  jht_employee_rate: 2,
  jht_employer_rate: 3.7,
  jp_employee_rate: 1,
  jp_employer_rate: 2,
  jp_max_salary: 10547400,
  jkk_employer_rate: 0.24,
  jkm_employer_rate: 0.3,
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v);

export default function BPJSSettings() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [config, setConfig] = useState<BPJSConfig>(DEFAULT_BPJS_CONFIG);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "bpjs_config")
        .maybeSingle();
      if (error) throw error;
      if (data?.value) setConfig({ ...DEFAULT_BPJS_CONFIG, ...(data.value as any) });
    } catch (e: any) {
      console.error("Error fetching BPJS config:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data: existing } = await supabase
        .from("system_settings")
        .select("id")
        .eq("key", "bpjs_config")
        .maybeSingle();

      const payload = { key: "bpjs_config", value: config as any, description: "Konfigurasi tarif BPJS Ketenagakerjaan & Kesehatan", updated_at: new Date().toISOString() };

      if (existing) {
        const { error } = await supabase.from("system_settings").update(payload).eq("key", "bpjs_config");
        if (error) throw error;
      } else {
        const { error } = await supabase.from("system_settings").insert(payload);
        if (error) throw error;
      }
      toast.success("Pengaturan BPJS berhasil disimpan");
    } catch (e: any) {
      toast.error("Gagal menyimpan: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (field: keyof BPJSConfig, value: string) => {
    const num = parseFloat(value) || 0;
    setConfig(prev => ({ ...prev, [field]: num }));
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6 animate-fadeIn">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/settings")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Pengaturan BPJS</h1>
            <p className="text-sm text-muted-foreground">Konfigurasi tarif dan batas gaji BPJS Ketenagakerjaan & Kesehatan</p>
          </div>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Perubahan tarif BPJS akan diterapkan saat <strong>Generate Payroll</strong> berikutnya. Tarif dalam persen (%).
            Pastikan menyesuaikan dengan regulasi terbaru dari BPJS.
          </AlertDescription>
        </Alert>

        {/* BPJS Kesehatan */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Shield className="h-5 w-5 text-primary" /> BPJS Kesehatan
            </CardTitle>
            <CardDescription>Tarif iuran dan batas maksimal gaji untuk perhitungan BPJS Kesehatan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Tarif Karyawan (%)</Label>
                <Input type="number" step="0.01" value={config.kes_employee_rate} onChange={e => updateField("kes_employee_rate", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Tarif Perusahaan (%)</Label>
                <Input type="number" step="0.01" value={config.kes_employer_rate} onChange={e => updateField("kes_employer_rate", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Batas Maks. Gaji</Label>
                <Input type="number" value={config.kes_max_salary} onChange={e => updateField("kes_max_salary", e.target.value)} />
                <p className="text-xs text-muted-foreground">{formatCurrency(config.kes_max_salary)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* JHT */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Jaminan Hari Tua (JHT)</CardTitle>
            <CardDescription>Tarif iuran JHT karyawan dan perusahaan (tanpa batas gaji)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tarif Karyawan (%)</Label>
                <Input type="number" step="0.01" value={config.jht_employee_rate} onChange={e => updateField("jht_employee_rate", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Tarif Perusahaan (%)</Label>
                <Input type="number" step="0.01" value={config.jht_employer_rate} onChange={e => updateField("jht_employer_rate", e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* JP */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Jaminan Pensiun (JP)</CardTitle>
            <CardDescription>Tarif iuran JP dan batas maksimal gaji (berubah setiap tahun sesuai regulasi)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Tarif Karyawan (%)</Label>
                <Input type="number" step="0.01" value={config.jp_employee_rate} onChange={e => updateField("jp_employee_rate", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Tarif Perusahaan (%)</Label>
                <Input type="number" step="0.01" value={config.jp_employer_rate} onChange={e => updateField("jp_employer_rate", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Batas Maks. Gaji</Label>
                <Input type="number" value={config.jp_max_salary} onChange={e => updateField("jp_max_salary", e.target.value)} />
                <p className="text-xs text-muted-foreground">{formatCurrency(config.jp_max_salary)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* JKK & JKM */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">JKK & JKM (Ditanggung Perusahaan)</CardTitle>
            <CardDescription>Jaminan Kecelakaan Kerja dan Jaminan Kematian — seluruhnya ditanggung perusahaan</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tarif JKK (%)</Label>
                <Input type="number" step="0.01" value={config.jkk_employer_rate} onChange={e => updateField("jkk_employer_rate", e.target.value)} />
                <p className="text-xs text-muted-foreground">Risiko sangat rendah: 0.24%, rendah: 0.54%, sedang: 0.89%, tinggi: 1.27%, sangat tinggi: 1.74%</p>
              </div>
              <div className="space-y-2">
                <Label>Tarif JKM (%)</Label>
                <Input type="number" step="0.01" value={config.jkm_employer_rate} onChange={e => updateField("jkm_employer_rate", e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Simulasi (Gaji Pokok Rp 10.000.000)</CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const salary = 10000000;
              const kesSalary = Math.min(salary, config.kes_max_salary);
              const jpSalary = Math.min(salary, config.jp_max_salary);
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <p className="font-semibold">Porsi Karyawan:</p>
                    <p>BPJS Kes: {formatCurrency(kesSalary * config.kes_employee_rate / 100)}</p>
                    <p>JHT: {formatCurrency(salary * config.jht_employee_rate / 100)}</p>
                    <p>JP: {formatCurrency(jpSalary * config.jp_employee_rate / 100)}</p>
                    <p className="font-semibold pt-1">Total: {formatCurrency(kesSalary * config.kes_employee_rate / 100 + salary * config.jht_employee_rate / 100 + jpSalary * config.jp_employee_rate / 100)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold">Porsi Perusahaan:</p>
                    <p>BPJS Kes: {formatCurrency(kesSalary * config.kes_employer_rate / 100)}</p>
                    <p>JHT: {formatCurrency(salary * config.jht_employer_rate / 100)}</p>
                    <p>JP: {formatCurrency(jpSalary * config.jp_employer_rate / 100)}</p>
                    <p>JKK: {formatCurrency(salary * config.jkk_employer_rate / 100)}</p>
                    <p>JKM: {formatCurrency(salary * config.jkm_employer_rate / 100)}</p>
                    <p className="font-semibold pt-1">Total: {formatCurrency(kesSalary * config.kes_employer_rate / 100 + salary * config.jht_employer_rate / 100 + jpSalary * config.jp_employer_rate / 100 + salary * config.jkk_employer_rate / 100 + salary * config.jkm_employer_rate / 100)}</p>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={() => navigate("/dashboard/settings")}>Batal</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Simpan Pengaturan
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
