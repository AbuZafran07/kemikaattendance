import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save, RotateCcw, Calculator } from "lucide-react";
import { formatRupiah, PTKP_VALUES } from "@/lib/payrollCalculation";

interface PTKPConfig {
  [key: string]: number;
}

// Default PTKP 2024
const DEFAULT_PTKP: PTKPConfig = { ...PTKP_VALUES };

const PTKP_LABELS: Record<string, string> = {
  "TK/0": "Tidak Kawin, tanpa tanggungan",
  "TK/1": "Tidak Kawin, 1 tanggungan",
  "TK/2": "Tidak Kawin, 2 tanggungan",
  "TK/3": "Tidak Kawin, 3 tanggungan",
  "K/0": "Kawin, tanpa tanggungan",
  "K/1": "Kawin, 1 tanggungan",
  "K/2": "Kawin, 2 tanggungan",
  "K/3": "Kawin, 3 tanggungan",
  "K/I/0": "Kawin, penghasilan istri digabung, tanpa tanggungan",
  "K/I/1": "Kawin, penghasilan istri digabung, 1 tanggungan",
  "K/I/2": "Kawin, penghasilan istri digabung, 2 tanggungan",
  "K/I/3": "Kawin, penghasilan istri digabung, 3 tanggungan",
};

export default function PTKPSettings() {
  const { toast } = useToast();
  const [ptkpValues, setPtkpValues] = useState<PTKPConfig>({ ...DEFAULT_PTKP });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_ptkp_config");
      if (!error && data) {
        const config = data as unknown as PTKPConfig;
        setPtkpValues({ ...DEFAULT_PTKP, ...config });
      }
    } catch (err) {
      console.error("Error fetching PTKP config:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleValueChange = (key: string, value: string) => {
    const numVal = parseInt(value.replace(/\D/g, "")) || 0;
    setPtkpValues((prev) => ({ ...prev, [key]: numVal }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("system_settings")
        .select("id")
        .eq("key", "ptkp_config")
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("system_settings")
          .update({ value: ptkpValues as any, updated_at: new Date().toISOString() })
          .eq("key", "ptkp_config");
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("system_settings")
          .insert({
            key: "ptkp_config",
            value: ptkpValues as any,
            description: "Pengaturan nilai PTKP (Penghasilan Tidak Kena Pajak)",
          });
        if (error) throw error;
      }

      toast({ title: "Berhasil", description: "Pengaturan PTKP berhasil disimpan" });
    } catch (err: any) {
      toast({ title: "Gagal", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setPtkpValues({ ...DEFAULT_PTKP });
    toast({ title: "Reset", description: "Nilai PTKP dikembalikan ke default 2024" });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const categories = [
    { label: "Tidak Kawin (TK)", keys: ["TK/0", "TK/1", "TK/2", "TK/3"] },
    { label: "Kawin (K)", keys: ["K/0", "K/1", "K/2", "K/3"] },
    { label: "Kawin, Penghasilan Istri Digabung (K/I)", keys: ["K/I/0", "K/I/1", "K/I/2", "K/I/3"] },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6 animate-fadeIn">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Pengaturan PTKP</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Kelola nilai Penghasilan Tidak Kena Pajak sesuai regulasi terbaru
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReset} size="sm">
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset Default
            </Button>
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Simpan
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calculator className="h-5 w-5 text-primary" />
              Nilai PTKP per Tahun
            </CardTitle>
            <CardDescription>
              Nilai PTKP digunakan untuk menghitung PPh 21 karyawan. Perubahan akan berlaku pada generate payroll berikutnya.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {categories.map((cat) => (
              <div key={cat.label}>
                <h3 className="font-semibold text-sm mb-3 text-primary">{cat.label}</h3>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">Status</TableHead>
                        <TableHead>Keterangan</TableHead>
                        <TableHead className="w-[200px]">Nilai PTKP / Tahun</TableHead>
                        <TableHead className="w-[150px] text-right">Preview</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cat.keys.map((key) => (
                        <TableRow key={key}>
                          <TableCell className="font-mono font-semibold">{key}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {PTKP_LABELS[key]}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="text"
                              value={ptkpValues[key]?.toLocaleString("id-ID") || "0"}
                              onChange={(e) => handleValueChange(key, e.target.value)}
                              className="text-right font-mono"
                            />
                          </TableCell>
                          <TableCell className="text-right text-sm font-mono">
                            {formatRupiah(ptkpValues[key] || 0)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Catatan</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>• PTKP digunakan sebagai pengurang penghasilan netto sebelum menghitung PPh 21.</p>
            <p>• Perubahan nilai PTKP akan otomatis berlaku saat generate payroll berikutnya.</p>
            <p>• Pastikan nilai yang dimasukkan sesuai dengan peraturan perpajakan yang berlaku.</p>
            <p>• Nilai default mengacu pada PMK No. 101/PMK.010/2016 (berlaku sejak 2016).</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
