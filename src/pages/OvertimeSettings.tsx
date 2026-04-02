import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, FileText, Save, Info, Calculator } from "lucide-react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { calculateOvertimePayPP35, formatRupiah } from "@/lib/payrollCalculation";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";


interface OvertimePolicyConfig {
  min_hours: number;
  max_hours_per_day: number;
  max_hours_per_week: number;
  max_hours_per_month: number;
  require_approval: boolean;
  min_days_advance_request: number;
  weekday_rate_multiplier: number;
  weekend_rate_multiplier: number;
  holiday_rate_multiplier: number;
  allow_weekend_overtime: boolean;
  allow_holiday_overtime: boolean;
  meal_allowance_threshold_hours: number;
  meal_allowance_amount: number;
  transport_allowance_enabled: boolean;
  transport_allowance_amount: number;
  holidays: { id: string; name: string; date: string }[];
}

export default function OvertimeSettings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [config, setConfig] = useState<OvertimePolicyConfig>({
    min_hours: 1,
    max_hours_per_day: 4,
    max_hours_per_week: 14,
    max_hours_per_month: 40,
    require_approval: true,
    min_days_advance_request: 1,
    weekday_rate_multiplier: 1.5,
    weekend_rate_multiplier: 2.0,
    holiday_rate_multiplier: 3.0,
    allow_weekend_overtime: true,
    allow_holiday_overtime: true,
    meal_allowance_threshold_hours: 3,
    meal_allowance_amount: 50000,
    transport_allowance_enabled: true,
    transport_allowance_amount: 30000,
    holidays: [],
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
        .eq("key", "overtime_policy")
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;

      if (data && data.value) {
        setConfig({ ...config, ...(data.value as unknown as OvertimePolicyConfig) });
      }
    } catch (error) {
      console.error("Error fetching overtime policy:", error);
      toast({
        title: "Gagal Memuat Data",
        description: "Tidak dapat memuat pengaturan kebijakan lembur",
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
        .eq("key", "overtime_policy")
        .maybeSingle();

      if (existingData) {
        const { error } = await supabase
          .from("system_settings")
          .update({
            value: config as any,
            updated_at: new Date().toISOString(),
          })
          .eq("key", "overtime_policy");

        if (error) throw error;
      } else {
        const { error } = await supabase.from("system_settings").insert({
          key: "overtime_policy",
          value: config as any,
          description: "Konfigurasi kebijakan lembur",
        });

        if (error) throw error;
      }

      toast({
        title: "Berhasil Disimpan",
        description: "Pengaturan kebijakan lembur telah diperbarui",
      });
    } catch (error) {
      console.error("Error saving overtime policy:", error);
      toast({
        title: "Gagal Menyimpan",
        description: "Tidak dapat menyimpan pengaturan kebijakan lembur",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex items-center gap-2 sm:gap-3 px-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10" onClick={() => navigate("/dashboard/settings")}>
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-3xl font-bold tracking-tight">Kebijakan Lembur</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">Atur aturan dan kompensasi lembur</p>
          </div>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="p-4 sm:p-6">
              <p className="text-sm text-muted-foreground">Memuat pengaturan...</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Batasan Jam Lembur */}
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                  Batasan Jam Lembur
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">Atur batasan waktu lembur karyawan</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6 pt-0 sm:pt-0">
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="min_hours">Minimal Jam Lembur</Label>
                    <Input
                      id="min_hours"
                      type="number"
                      min="1"
                      max="4"
                      step="0.5"
                      value={config.min_hours}
                      onChange={(e) =>
                        setConfig({ ...config, min_hours: parseFloat(e.target.value) || 1 })
                      }
                    />
                    <p className="text-xs text-muted-foreground">Jam minimal per pengajuan</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max_hours_day">Maksimal per Hari</Label>
                    <Input
                      id="max_hours_day"
                      type="number"
                      min="1"
                      max="8"
                      value={config.max_hours_per_day}
                      onChange={(e) =>
                        setConfig({ ...config, max_hours_per_day: parseInt(e.target.value) || 4 })
                      }
                    />
                    <p className="text-xs text-muted-foreground">Jam maksimal lembur per hari</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max_hours_week">Maksimal per Minggu</Label>
                    <Input
                      id="max_hours_week"
                      type="number"
                      min="1"
                      max="30"
                      value={config.max_hours_per_week}
                      onChange={(e) =>
                        setConfig({ ...config, max_hours_per_week: parseInt(e.target.value) || 14 })
                      }
                    />
                    <p className="text-xs text-muted-foreground">Jam maksimal lembur per minggu</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max_hours_month">Maksimal per Bulan</Label>
                    <Input
                      id="max_hours_month"
                      type="number"
                      min="1"
                      max="80"
                      value={config.max_hours_per_month}
                      onChange={(e) =>
                        setConfig({ ...config, max_hours_per_month: parseInt(e.target.value) || 40 })
                      }
                    />
                    <p className="text-xs text-muted-foreground">Jam maksimal lembur per bulan</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Aturan Pengajuan */}
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg">Aturan Pengajuan Lembur</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Konfigurasi aturan dan batasan pengajuan lembur</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6 pt-0 sm:pt-0">
                <div className="space-y-2">
                  <Label htmlFor="min_days_advance">Minimal Pengajuan (hari sebelumnya)</Label>
                  <Input
                    id="min_days_advance"
                    type="number"
                    min="0"
                    max="7"
                    value={config.min_days_advance_request}
                    onChange={(e) =>
                      setConfig({ ...config, min_days_advance_request: parseInt(e.target.value) || 0 })
                    }
                    className="w-32"
                  />
                  <p className="text-xs text-muted-foreground">Berapa hari minimal sebelum tanggal lembur harus diajukan (0 = bisa di hari yang sama)</p>
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="require_approval" className="cursor-pointer">
                    <div>
                      <p className="font-medium">Perlu Persetujuan Admin</p>
                      <p className="text-sm text-muted-foreground">
                        Semua pengajuan lembur harus disetujui oleh admin sebelum dihitung
                      </p>
                    </div>
                  </Label>
                  <Switch
                    id="require_approval"
                    checked={config.require_approval}
                    onCheckedChange={(checked) => setConfig({ ...config, require_approval: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="allow_weekend" className="cursor-pointer">
                    <div>
                      <p className="font-medium">Izinkan Lembur Weekend</p>
                      <p className="text-sm text-muted-foreground">
                        Karyawan dapat mengajukan lembur di hari Sabtu dan Minggu
                      </p>
                    </div>
                  </Label>
                  <Switch
                    id="allow_weekend"
                    checked={config.allow_weekend_overtime}
                    onCheckedChange={(checked) =>
                      setConfig({ ...config, allow_weekend_overtime: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="allow_holiday" className="cursor-pointer">
                    <div>
                      <p className="font-medium">Izinkan Lembur Hari Libur</p>
                      <p className="text-sm text-muted-foreground">
                        Karyawan dapat mengajukan lembur di hari libur nasional
                      </p>
                    </div>
                  </Label>
                  <Switch
                    id="allow_holiday"
                    checked={config.allow_holiday_overtime}
                    onCheckedChange={(checked) =>
                      setConfig({ ...config, allow_holiday_overtime: checked })
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* Kompensasi Lembur */}
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg">Multiplier Upah Lembur</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Atur perkalian upah untuk jenis hari lembur</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6 pt-0 sm:pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="weekday_rate">Hari Kerja</Label>
                    <Input
                      id="weekday_rate"
                      type="number"
                      min="1"
                      max="5"
                      step="0.1"
                      value={config.weekday_rate_multiplier}
                      onChange={(e) =>
                        setConfig({ ...config, weekday_rate_multiplier: parseFloat(e.target.value) || 1.5 })
                      }
                    />
                    <p className="text-xs text-muted-foreground">Contoh: 1.5x = upah per jam × 1.5</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="weekend_rate">Weekend</Label>
                    <Input
                      id="weekend_rate"
                      type="number"
                      min="1"
                      max="5"
                      step="0.1"
                      value={config.weekend_rate_multiplier}
                      onChange={(e) =>
                        setConfig({ ...config, weekend_rate_multiplier: parseFloat(e.target.value) || 2.0 })
                      }
                    />
                    <p className="text-xs text-muted-foreground">Contoh: 2x = upah per jam × 2</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="holiday_rate">Hari Libur Nasional</Label>
                    <Input
                      id="holiday_rate"
                      type="number"
                      min="1"
                      max="5"
                      step="0.1"
                      value={config.holiday_rate_multiplier}
                      onChange={(e) =>
                        setConfig({ ...config, holiday_rate_multiplier: parseFloat(e.target.value) || 3.0 })
                      }
                    />
                    <p className="text-xs text-muted-foreground">Contoh: 3x = upah per jam × 3</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tunjangan */}
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg">Tunjangan Lembur</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Atur tunjangan tambahan untuk lembur</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6 pt-0 sm:pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="meal_threshold">Batas Jam untuk Uang Makan</Label>
                    <Input
                      id="meal_threshold"
                      type="number"
                      min="1"
                      max="8"
                      value={config.meal_allowance_threshold_hours}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          meal_allowance_threshold_hours: parseInt(e.target.value) || 3,
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Lembur minimal berapa jam untuk mendapat uang makan
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="meal_amount">Besaran Uang Makan</Label>
                    <Input
                      id="meal_amount"
                      type="number"
                      min="0"
                      step="5000"
                      value={config.meal_allowance_amount}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          meal_allowance_amount: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(config.meal_allowance_amount)} per lembur
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="transport_enabled" className="cursor-pointer">
                    <div>
                      <p className="font-medium">Tunjangan Transport</p>
                      <p className="text-sm text-muted-foreground">
                        Berikan tunjangan transport untuk karyawan yang lembur
                      </p>
                    </div>
                  </Label>
                  <Switch
                    id="transport_enabled"
                    checked={config.transport_allowance_enabled}
                    onCheckedChange={(checked) =>
                      setConfig({ ...config, transport_allowance_enabled: checked })
                    }
                  />
                </div>

                {config.transport_allowance_enabled && (
                  <div className="ml-6 space-y-2">
                    <Label htmlFor="transport_amount">Besaran Tunjangan Transport</Label>
                    <Input
                      id="transport_amount"
                      type="number"
                      min="0"
                      step="5000"
                      value={config.transport_allowance_amount}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          transport_allowance_amount: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-48"
                    />
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(config.transport_allowance_amount)} per lembur
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Note: Hari Libur & Event Kantor dipindah ke menu terpisah */}

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Perubahan pengaturan ini akan berlaku untuk pengajuan lembur baru. Pengajuan lembur yang sudah disetujui tidak akan terpengaruh.
              </AlertDescription>
            </Alert>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => navigate("/dashboard/settings")}>
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
