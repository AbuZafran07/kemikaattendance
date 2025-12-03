import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";

interface WorkHoursConfig {
  check_in_start: string;
  check_in_end: string;
  check_out_start: string;
  check_out_end: string;
  late_tolerance_minutes: number;
  early_leave_tolerance_minutes: number;
}

export default function WorkHoursSettings() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [config, setConfig] = useState<WorkHoursConfig>({
    check_in_start: "08:00",
    check_in_end: "09:00",
    check_out_start: "17:00",
    check_out_end: "18:00",
    late_tolerance_minutes: 15,
    early_leave_tolerance_minutes: 15,
  });

  useEffect(() => {
    fetchWorkHours();
  }, []);

  const fetchWorkHours = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "work_hours")
        .maybeSingle();

      if (error) throw error;

      if (data && data.value) {
        setConfig(data.value as unknown as WorkHoursConfig);
      }
    } catch (error) {
      console.error("Error fetching work hours:", error);
      toast({
        title: "Gagal Memuat Data",
        description: "Tidak dapat memuat pengaturan jam kerja",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Check if setting exists
      const { data: existingData } = await supabase
        .from("system_settings")
        .select("id")
        .eq("key", "work_hours")
        .maybeSingle();

      if (existingData) {
        // Update existing
        const { error } = await supabase
          .from("system_settings")
          .update({
            value: config as any,
            updated_at: new Date().toISOString(),
          })
          .eq("key", "work_hours");

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase.from("system_settings").insert({
          key: "work_hours",
          value: config as any,
          description: "Konfigurasi jam kerja dan toleransi",
        });

        if (error) throw error;
      }

      toast({
        title: "Berhasil Disimpan",
        description: "Pengaturan jam kerja telah diperbarui",
      });
    } catch (error) {
      console.error("Error saving work hours:", error);
      toast({
        title: "Gagal Menyimpan",
        description: "Tidak dapat menyimpan pengaturan jam kerja",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Jam Kerja</h1>
          <p className="text-muted-foreground mt-1">Atur jam kerja dan toleransi keterlambatan</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Pengaturan Jam Kerja
            </CardTitle>
            <CardDescription>Konfigurasi jam masuk, jam pulang, dan toleransi keterlambatan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <p className="text-muted-foreground">Memuat pengaturan...</p>
            ) : (
              <>
                {/* Check-In Settings */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Jam Masuk</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="check_in_start">Waktu Mulai Check-In</Label>
                      <Input
                        id="check_in_start"
                        type="time"
                        value={config.check_in_start}
                        onChange={(e) => setConfig({ ...config, check_in_start: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">Waktu paling awal karyawan dapat check-in</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="check_in_end">Batas Waktu Check-In</Label>
                      <Input
                        id="check_in_end"
                        type="time"
                        value={config.check_in_end}
                        onChange={(e) => setConfig({ ...config, check_in_end: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Batas waktu check-in tepat waktu (sebelum dianggap terlambat)
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="late_tolerance">Toleransi Keterlambatan (menit)</Label>
                    <Input
                      id="late_tolerance"
                      type="number"
                      min="0"
                      max="60"
                      value={config.late_tolerance_minutes}
                      onChange={(e) => setConfig({ ...config, late_tolerance_minutes: parseInt(e.target.value) || 0 })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Tambahan waktu toleransi setelah batas check-in sebelum status berubah menjadi "Terlambat"
                    </p>
                  </div>
                </div>

                {/* Check-Out Settings */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Jam Pulang</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="check_out_start">Waktu Mulai Check-Out</Label>
                      <Input
                        id="check_out_start"
                        type="time"
                        value={config.check_out_start}
                        onChange={(e) => setConfig({ ...config, check_out_start: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">Waktu paling awal karyawan dapat check-out normal</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="check_out_end">Batas Waktu Check-Out</Label>
                      <Input
                        id="check_out_end"
                        type="time"
                        value={config.check_out_end}
                        onChange={(e) => setConfig({ ...config, check_out_end: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">Batas waktu check-out maksimal</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="early_leave_tolerance">Toleransi Pulang Cepat (menit)</Label>
                    <Input
                      id="early_leave_tolerance"
                      type="number"
                      min="0"
                      max="60"
                      value={config.early_leave_tolerance_minutes}
                      onChange={(e) =>
                        setConfig({ ...config, early_leave_tolerance_minutes: parseInt(e.target.value) || 0 })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Toleransi waktu sebelum jam pulang normal. Check-out lebih awal dari ini akan dianggap "Pulang
                      Cepat"
                    </p>
                  </div>
                </div>

                {/* Example */}
                <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                  <h4 className="font-semibold text-sm">Contoh:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>
                      • Check-in sebelum <strong>{config.check_in_end}</strong> + {config.late_tolerance_minutes} menit
                      (
                      {(() => {
                        const [h, m] = config.check_in_end.split(":").map(Number);
                        const totalMinutes = h * 60 + m + config.late_tolerance_minutes;
                        const newH = Math.floor(totalMinutes / 60);
                        const newM = totalMinutes % 60;
                        return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
                      })()}
                      ) = Status <strong>Hadir</strong>
                    </li>
                    <li>
                      • Check-in setelah{" "}
                      {(() => {
                        const [h, m] = config.check_in_end.split(":").map(Number);
                        const totalMinutes = h * 60 + m + config.late_tolerance_minutes;
                        const newH = Math.floor(totalMinutes / 60);
                        const newM = totalMinutes % 60;
                        return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
                      })()}{" "}
                      = Status <strong>Terlambat</strong>
                    </li>
                    <li>
                      • Check-out sebelum <strong>{config.check_out_start}</strong> -{" "}
                      {config.early_leave_tolerance_minutes} menit (
                      {(() => {
                        const [h, m] = config.check_out_start.split(":").map(Number);
                        const totalMinutes = h * 60 + m - config.early_leave_tolerance_minutes;
                        const newH = Math.floor(totalMinutes / 60);
                        const newM = totalMinutes % 60;
                        return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
                      })()}
                      ) = Status <strong>Pulang Cepat</strong>
                    </li>
                  </ul>
                </div>

                <Button onClick={handleSave} disabled={isSaving} className="w-full md:w-auto">
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? "Menyimpan..." : "Simpan Pengaturan"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
