import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Calendar, Save, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface LeavePolicyConfig {
  annual_leave_quota: number;
  sick_leave_quota: number;
  permission_quota: number;
  carry_over_enabled: boolean;
  max_carry_over_days: number;
  min_days_advance_request: number;
  max_consecutive_days: number;
  require_approval: boolean;
  auto_reset_on_anniversary: boolean;
  reset_month: number;
}

export default function LeaveSettings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [config, setConfig] = useState<LeavePolicyConfig>({
    annual_leave_quota: 12,
    sick_leave_quota: 12,
    permission_quota: 6,
    carry_over_enabled: false,
    max_carry_over_days: 5,
    min_days_advance_request: 3,
    max_consecutive_days: 14,
    require_approval: true,
    auto_reset_on_anniversary: true,
    reset_month: 1,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "leave_policy")
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;

      if (data && data.value) {
        setConfig({ ...config, ...(data.value as unknown as LeavePolicyConfig) });
      }
    } catch (error) {
      console.error("Error fetching leave policy:", error);
      toast({
        title: "Gagal Memuat Data",
        description: "Tidak dapat memuat pengaturan kebijakan cuti",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data: existingData } = await supabase
        .from("system_settings")
        .select("id")
        .eq("key", "leave_policy")
        .maybeSingle();

      if (existingData) {
        const { error } = await supabase
          .from("system_settings")
          .update({
            value: config as any,
            updated_at: new Date().toISOString(),
          })
          .eq("key", "leave_policy");

        if (error) throw error;
      } else {
        const { error } = await supabase.from("system_settings").insert({
          key: "leave_policy",
          value: config as any,
          description: "Konfigurasi kebijakan cuti",
        });

        if (error) throw error;
      }

      toast({
        title: "Berhasil Disimpan",
        description: "Pengaturan kebijakan cuti telah diperbarui",
      });
    } catch (error) {
      console.error("Error saving leave policy:", error);
      toast({
        title: "Gagal Menyimpan",
        description: "Tidak dapat menyimpan pengaturan kebijakan cuti",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const months = [
    { value: 1, label: "Januari" },
    { value: 2, label: "Februari" },
    { value: 3, label: "Maret" },
    { value: 4, label: "April" },
    { value: 5, label: "Mei" },
    { value: 6, label: "Juni" },
    { value: 7, label: "Juli" },
    { value: 8, label: "Agustus" },
    { value: 9, label: "September" },
    { value: 10, label: "Oktober" },
    { value: 11, label: "November" },
    { value: 12, label: "Desember" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/settings")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Kebijakan Cuti</h1>
            <p className="text-muted-foreground mt-1">Kelola kuota dan aturan cuti</p>
          </div>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground">Memuat pengaturan...</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Kuota Cuti */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Kuota Cuti Tahunan
                </CardTitle>
                <CardDescription>Atur jumlah hari cuti yang diberikan kepada karyawan</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="annual_leave_quota">Cuti Tahunan (hari)</Label>
                    <Input
                      id="annual_leave_quota"
                      type="number"
                      min="0"
                      max="30"
                      value={config.annual_leave_quota}
                      onChange={(e) =>
                        setConfig({ ...config, annual_leave_quota: parseInt(e.target.value) || 0 })
                      }
                    />
                    <p className="text-xs text-muted-foreground">Kuota cuti tahunan untuk setiap karyawan</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sick_leave_quota">Cuti Sakit (hari)</Label>
                    <Input
                      id="sick_leave_quota"
                      type="number"
                      min="0"
                      max="30"
                      value={config.sick_leave_quota}
                      onChange={(e) =>
                        setConfig({ ...config, sick_leave_quota: parseInt(e.target.value) || 0 })
                      }
                    />
                    <p className="text-xs text-muted-foreground">Kuota maksimal cuti sakit per tahun</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="permission_quota">Izin (hari)</Label>
                    <Input
                      id="permission_quota"
                      type="number"
                      min="0"
                      max="30"
                      value={config.permission_quota}
                      onChange={(e) =>
                        setConfig({ ...config, permission_quota: parseInt(e.target.value) || 0 })
                      }
                    />
                    <p className="text-xs text-muted-foreground">Kuota maksimal izin per tahun</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Aturan Cuti */}
            <Card>
              <CardHeader>
                <CardTitle>Aturan Pengajuan Cuti</CardTitle>
                <CardDescription>Konfigurasi aturan dan batasan pengajuan cuti</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="min_days_advance">Minimal Pengajuan (hari sebelumnya)</Label>
                    <Input
                      id="min_days_advance"
                      type="number"
                      min="0"
                      max="30"
                      value={config.min_days_advance_request}
                      onChange={(e) =>
                        setConfig({ ...config, min_days_advance_request: parseInt(e.target.value) || 0 })
                      }
                    />
                    <p className="text-xs text-muted-foreground">Berapa hari minimal sebelum tanggal cuti harus diajukan</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max_consecutive">Maksimal Cuti Berturut-turut (hari)</Label>
                    <Input
                      id="max_consecutive"
                      type="number"
                      min="1"
                      max="30"
                      value={config.max_consecutive_days}
                      onChange={(e) =>
                        setConfig({ ...config, max_consecutive_days: parseInt(e.target.value) || 1 })
                      }
                    />
                    <p className="text-xs text-muted-foreground">Maksimal hari cuti yang bisa diambil secara berturut-turut</p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="require_approval" className="cursor-pointer">
                    <div>
                      <p className="font-medium">Perlu Persetujuan Admin</p>
                      <p className="text-sm text-muted-foreground">
                        Semua pengajuan cuti harus disetujui oleh admin sebelum berlaku
                      </p>
                    </div>
                  </Label>
                  <Switch
                    id="require_approval"
                    checked={config.require_approval}
                    onCheckedChange={(checked) => setConfig({ ...config, require_approval: checked })}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Carry Over */}
            <Card>
              <CardHeader>
                <CardTitle>Sisa Cuti & Reset</CardTitle>
                <CardDescription>Pengaturan sisa cuti yang dapat dibawa ke tahun berikutnya</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <Label htmlFor="carry_over" className="cursor-pointer">
                    <div>
                      <p className="font-medium">Izinkan Carry Over</p>
                      <p className="text-sm text-muted-foreground">
                        Sisa cuti dapat dibawa ke tahun berikutnya
                      </p>
                    </div>
                  </Label>
                  <Switch
                    id="carry_over"
                    checked={config.carry_over_enabled}
                    onCheckedChange={(checked) => setConfig({ ...config, carry_over_enabled: checked })}
                  />
                </div>

                {config.carry_over_enabled && (
                  <div className="ml-6 space-y-2">
                    <Label htmlFor="max_carry_over">Maksimal Hari Carry Over</Label>
                    <Input
                      id="max_carry_over"
                      type="number"
                      min="1"
                      max="15"
                      value={config.max_carry_over_days}
                      onChange={(e) =>
                        setConfig({ ...config, max_carry_over_days: parseInt(e.target.value) || 1 })
                      }
                      className="w-32"
                    />
                    <p className="text-xs text-muted-foreground">Jumlah hari maksimal yang bisa dibawa ke tahun berikutnya</p>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <Label htmlFor="auto_reset" className="cursor-pointer">
                    <div>
                      <p className="font-medium">Reset Otomatis</p>
                      <p className="text-sm text-muted-foreground">
                        Kuota cuti akan direset otomatis setiap tahun
                      </p>
                    </div>
                  </Label>
                  <Switch
                    id="auto_reset"
                    checked={config.auto_reset_on_anniversary}
                    onCheckedChange={(checked) =>
                      setConfig({ ...config, auto_reset_on_anniversary: checked })
                    }
                  />
                </div>

                {config.auto_reset_on_anniversary && (
                  <div className="ml-6 space-y-2">
                    <Label htmlFor="reset_month">Bulan Reset</Label>
                    <select
                      id="reset_month"
                      value={config.reset_month}
                      onChange={(e) => setConfig({ ...config, reset_month: parseInt(e.target.value) })}
                      className="flex h-10 w-48 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      {months.map((month) => (
                        <option key={month.value} value={month.value}>
                          {month.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">Bulan dimana kuota cuti akan direset</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Perubahan pengaturan ini akan berlaku untuk pengajuan cuti baru. Pengajuan cuti yang sudah disetujui tidak akan terpengaruh.
              </AlertDescription>
            </Alert>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => navigate("/settings")}>
                Batal
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? "Menyimpan..." : "Simpan Pengaturan"}
              </Button>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
