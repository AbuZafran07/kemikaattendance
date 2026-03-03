import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Landmark, Loader2, Save, ArrowLeft } from "lucide-react";

const BANK_OPTIONS = [
  "BCA",
  "Mandiri",
  "BRI",
  "BNI",
  "BSI",
  "Bank Syariah Mandiri",
  "CIMB Niaga",
  "Danamon",
  "Permata",
  "BTPN",
  "Mega",
  "OCBC NISP",
];

export default function CompanyBankSettings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accountNumber, setAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const { data } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "company_bank_config")
        .single();

      if (data?.value) {
        const config = data.value as any;
        setAccountNumber(config.account_number || "");
        setBankName(config.bank_name || "");
      }
    } catch {
      // No config yet, that's fine
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!accountNumber.trim()) {
      toast({ title: "Error", description: "Nomor rekening wajib diisi", variant: "destructive" });
      return;
    }
    if (!bankName) {
      toast({ title: "Error", description: "Nama bank wajib dipilih", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const value = {
        account_number: accountNumber.trim(),
        bank_name: bankName,
      };

      // Check if exists
      const { data: existing } = await supabase
        .from("system_settings")
        .select("id")
        .eq("key", "company_bank_config")
        .single();

      if (existing) {
        await supabase
          .from("system_settings")
          .update({ value: value as any, updated_at: new Date().toISOString() })
          .eq("key", "company_bank_config");
      } else {
        await supabase
          .from("system_settings")
          .insert({ key: "company_bank_config", value: value as any, description: "Konfigurasi rekening bank perusahaan untuk e-Payroll" });
      }

      toast({ title: "Berhasil", description: "Konfigurasi bank perusahaan berhasil disimpan." });
    } catch (error: any) {
      toast({ title: "Gagal", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fadeIn">
        <div className="flex items-center gap-2 sm:gap-3 px-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10" onClick={() => navigate("/dashboard/settings")}>
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Pengaturan Bank Perusahaan</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
              Atur rekening perusahaan yang digunakan sebagai sumber dana pada file e-Payroll bank
            </p>
          </div>
        </div>

        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Rekening Perusahaan</CardTitle>
            <CardDescription>
              Data ini digunakan sebagai header file e-Payroll untuk transfer gaji massal otomatis ke bank
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bankName">Nama Bank</Label>
              <Select value={bankName} onValueChange={setBankName}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih bank" />
                </SelectTrigger>
                <SelectContent>
                  {BANK_OPTIONS.map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accountNumber">Nomor Rekening Perusahaan</Label>
              <Input
                id="accountNumber"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="Contoh: 1550057555750"
              />
            </div>

            <Button onClick={handleSave} disabled={saving} className="gap-2 w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Simpan Konfigurasi
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
