
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, Loader2, Plus, Trash2, Info, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatRupiah } from "@/lib/payrollCalculation";

export interface TaxBracket {
  limit: number;    // upper limit in Rp (use 0 for Infinity)
  rate: number;     // rate in percent, e.g. 5
}

const DEFAULT_BRACKETS: TaxBracket[] = [
  { limit: 60000000, rate: 5 },
  { limit: 250000000, rate: 15 },
  { limit: 500000000, rate: 25 },
  { limit: 5000000000, rate: 30 },
  { limit: 0, rate: 35 }, // 0 = Infinity (selebihnya)
];

export default function PPh21BracketsSettings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [brackets, setBrackets] = useState<TaxBracket[]>(DEFAULT_BRACKETS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "pph21_brackets_config")
        .maybeSingle();

      if (data?.value) {
        const val = data.value as any;
        if (val.brackets && Array.isArray(val.brackets) && val.brackets.length > 0) {
          setBrackets(val.brackets);
        }
      }
    } catch (error) {
      console.error("Error fetching brackets config:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Validate
    for (let i = 0; i < brackets.length; i++) {
      if (brackets[i].rate < 0 || brackets[i].rate > 100) {
        toast({ title: "Error", description: `Tarif lapisan ${i + 1} harus antara 0-100%`, variant: "destructive" });
        return;
      }
      if (i < brackets.length - 1 && brackets[i].limit <= 0) {
        toast({ title: "Error", description: `Batas atas lapisan ${i + 1} harus lebih dari 0 (kecuali lapisan terakhir)`, variant: "destructive" });
        return;
      }
      if (i > 0 && brackets[i].limit !== 0 && brackets[i].limit <= brackets[i - 1].limit) {
        toast({ title: "Error", description: `Batas atas lapisan ${i + 1} harus lebih besar dari lapisan sebelumnya`, variant: "destructive" });
        return;
      }
    }

    setSaving(true);
    try {
      const payload = { brackets };
      const { data: existing } = await supabase
        .from("system_settings")
        .select("id")
        .eq("key", "pph21_brackets_config")
        .maybeSingle();

      if (existing) {
        await supabase.from("system_settings")
          .update({ value: payload as any, updated_at: new Date().toISOString() })
          .eq("key", "pph21_brackets_config");
      } else {
        await supabase.from("system_settings")
          .insert({ key: "pph21_brackets_config", value: payload as any, description: "Konfigurasi tarif PPh 21 progresif" });
      }

      toast({ title: "Berhasil", description: "Tarif PPh 21 progresif berhasil disimpan." });
    } catch (error: any) {
      toast({ title: "Gagal", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateBracket = (index: number, field: keyof TaxBracket, value: string) => {
    setBrackets(prev => prev.map((b, i) => i === index ? { ...b, [field]: Number(value) || 0 } : b));
  };

  const addBracket = () => {
    const lastBracket = brackets[brackets.length - 1];
    // Insert before the last (infinity) bracket
    const newBrackets = [...brackets];
    const newLimit = brackets.length > 1 ? brackets[brackets.length - 2].limit * 2 : 100000000;
    newBrackets.splice(brackets.length - 1, 0, { limit: newLimit, rate: lastBracket.rate > 5 ? lastBracket.rate - 5 : 5 });
    setBrackets(newBrackets);
  };

  const removeBracket = (index: number) => {
    if (brackets.length <= 1) return;
    setBrackets(prev => prev.filter((_, i) => i !== index));
  };

  const resetToDefault = () => {
    setBrackets([...DEFAULT_BRACKETS]);
    toast({ title: "Reset", description: "Tarif dikembalikan ke default UU HPP. Klik Simpan untuk menyimpan." });
  };

  // Simulation
  const simPkp = 100000000;
  const simTax = calculateWithBrackets(simPkp, brackets);

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
      <div className="space-y-4 sm:space-y-6 animate-fadeIn max-w-3xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/settings")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Tarif PPh 21 Progresif</h1>
            <p className="text-sm text-muted-foreground mt-1">Konfigurasi lapisan tarif pajak penghasilan sesuai regulasi yang berlaku</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Lapisan Tarif Pajak</CardTitle>
                <CardDescription>Sesuaikan dengan UU PPh yang berlaku (saat ini UU HPP)</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={resetToDefault} className="gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Default
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Header */}
            <div className="grid grid-cols-[1fr_100px_40px] gap-3 text-xs font-medium text-muted-foreground px-1">
              <span>Batas PKP (Rp)</span>
              <span>Tarif (%)</span>
              <span></span>
            </div>

            {brackets.map((bracket, index) => {
              const prevLimit = index > 0 ? brackets[index - 1].limit : 0;
              const isLast = index === brackets.length - 1 && bracket.limit === 0;

              return (
                <div key={index} className="grid grid-cols-[1fr_100px_40px] gap-3 items-center">
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">
                      {prevLimit > 0 ? `Di atas ${formatRupiah(prevLimit)}` : "Sampai dengan"}
                      {isLast ? " (selebihnya)" : ""}
                    </div>
                    {isLast ? (
                      <Input value="∞ (Selebihnya)" disabled className="text-muted-foreground" />
                    ) : (
                      <Input
                        type="number"
                        min={prevLimit + 1}
                        step={1000000}
                        value={bracket.limit}
                        onChange={(e) => updateBracket(index, "limit", e.target.value)}
                      />
                    )}
                  </div>
                  <div>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      value={bracket.rate}
                      onChange={(e) => updateBracket(index, "rate", e.target.value)}
                    />
                  </div>
                  <div>
                    {brackets.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => removeBracket(index)} className="h-8 w-8 text-destructive hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}

            <Button variant="outline" size="sm" onClick={addBracket} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Tambah Lapisan
            </Button>
          </CardContent>
        </Card>

        {/* Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ringkasan Tarif</CardTitle>
            <CardDescription>Tabel tarif yang akan diterapkan</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left p-2 font-medium">Lapisan</th>
                    <th className="text-left p-2 font-medium">PKP</th>
                    <th className="text-right p-2 font-medium">Tarif</th>
                  </tr>
                </thead>
                <tbody>
                  {brackets.map((bracket, index) => {
                    const prevLimit = index > 0 ? brackets[index - 1].limit : 0;
                    const isLast = bracket.limit === 0;
                    return (
                      <tr key={index} className="border-t border-border">
                        <td className="p-2">{index + 1}</td>
                        <td className="p-2">
                          {isLast
                            ? `Di atas ${formatRupiah(prevLimit)}`
                            : prevLimit === 0
                              ? `s.d. ${formatRupiah(bracket.limit)}`
                              : `${formatRupiah(prevLimit + 1)} - ${formatRupiah(bracket.limit)}`
                          }
                        </td>
                        <td className="p-2 text-right font-medium">{bracket.rate}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Simulation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Simulasi Perhitungan</CardTitle>
            <CardDescription>Contoh dengan PKP {formatRupiah(simPkp)}/tahun</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 text-sm">
              {brackets.map((bracket, index) => {
                const prevLimit = index > 0 ? brackets[index - 1].limit : 0;
                const effectiveLimit = bracket.limit === 0 ? Infinity : bracket.limit;
                const taxableInBracket = Math.max(0, Math.min(simPkp - prevLimit, effectiveLimit - prevLimit));
                if (taxableInBracket <= 0) return null;
                const taxInBracket = taxableInBracket * (bracket.rate / 100);
                return (
                  <div key={index} className="flex justify-between">
                    <span className="text-muted-foreground">
                      {formatRupiah(taxableInBracket)} × {bracket.rate}%
                    </span>
                    <span>{formatRupiah(Math.round(taxInBracket))}</span>
                  </div>
                );
              })}
              <div className="flex justify-between border-t pt-2 font-medium">
                <span>PPh 21 Terutang / Tahun</span>
                <span>{formatRupiah(simTax)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>PPh 21 / Bulan</span>
                <span>{formatRupiah(Math.round(simTax / 12))}</span>
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

function calculateWithBrackets(pkp: number, brackets: TaxBracket[]): number {
  if (pkp <= 0) return 0;
  let remaining = pkp;
  let total = 0;
  let prevLimit = 0;
  for (const bracket of brackets) {
    const effectiveLimit = bracket.limit === 0 ? Infinity : bracket.limit;
    const taxable = Math.min(remaining, effectiveLimit - prevLimit);
    if (taxable <= 0) break;
    total += taxable * (bracket.rate / 100);
    remaining -= taxable;
    prevLimit = effectiveLimit;
  }
  return Math.round(total);
}
