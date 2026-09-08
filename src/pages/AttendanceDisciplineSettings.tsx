import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Save, Loader2, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export interface AttendanceDisciplineConfig {
  sp1_threshold: number;
  sp2_threshold: number;
  lock_threshold: number;
  three_month_warning_threshold: number;
  late_reason_deadline_hours: number;
  enable_progress_notifications: boolean;
}

export const DEFAULT_ATTENDANCE_DISCIPLINE_CONFIG: AttendanceDisciplineConfig = {
  sp1_threshold: 5,
  sp2_threshold: 8,
  lock_threshold: 11,
  three_month_warning_threshold: 10,
  late_reason_deadline_hours: 24,
  enable_progress_notifications: true,
};

const SETTINGS_KEY = "attendance_discipline_config";

export default function AttendanceDisciplineSettings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [config, setConfig] = useState<AttendanceDisciplineConfig>(DEFAULT_ATTENDANCE_DISCIPLINE_CONFIG);
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
        .eq("key", SETTINGS_KEY)
        .maybeSingle();

      if (data?.value) {
        const val = data.value as Record<string, unknown>;
        setConfig({
          sp1_threshold: Number(val.sp1_threshold) || DEFAULT_ATTENDANCE_DISCIPLINE_CONFIG.sp1_threshold,
          sp2_threshold: Number(val.sp2_threshold) || DEFAULT_ATTENDANCE_DISCIPLINE_CONFIG.sp2_threshold,
          lock_threshold: Number(val.lock_threshold) || DEFAULT_ATTENDANCE_DISCIPLINE_CONFIG.lock_threshold,
          three_month_warning_threshold:
            Number(val.three_month_warning_threshold) ||
            DEFAULT_ATTENDANCE_DISCIPLINE_CONFIG.three_month_warning_threshold,
          late_reason_deadline_hours:
            Number(val.late_reason_deadline_hours) ||
            DEFAULT_ATTENDANCE_DISCIPLINE_CONFIG.late_reason_deadline_hours,
          enable_progress_notifications: val.enable_progress_notifications !== false,
        });
      }
    } catch (error) {
      console.error("Error fetching attendance discipline config:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (
      !(config.sp1_threshold < config.sp2_threshold && config.sp2_threshold < config.lock_threshold)
    ) {
      toast({
        title: "Ambang batas tidak valid",
        description: "Urutan harus: SP1 < SP2 < Lock Akun.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("system_settings")
        .select("id")
        .eq("key", SETTINGS_KEY)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("system_settings")
          .update({ value: config as never, updated_at: new Date().toISOString() })
          .eq("key", SETTINGS_KEY);
      } else {
        await supabase.from("system_settings").insert({
          key: SETTINGS_KEY,
          value: config as never,
          description: "Konfigurasi ambang batas sistem disiplin absensi",
        });
      }

      toast({ title: "Berhasil", description: "Pengaturan disiplin absensi berhasil disimpan." });
    } catch (error) {
      toast({
        title: "Gagal",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const numberField = (
    key: keyof AttendanceDisciplineConfig,
    label: string,
    hint: string,
    suffix: string
  ) => (
    <div className="space-y-2">
      <Label htmlFor={key}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={key}
          type="number"
          min={1}
          value={config[key] as number}
          onChange={(e) => setConfig({ ...config, [key]: Number(e.target.value) })}
        />
        <span className="text-sm text-muted-foreground whitespace-nowrap">{suffix}</span>
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );

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
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Pengaturan Disiplin Absensi</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Ambang batas pelanggaran untuk surat peringatan, lock akun, dan peringatan dini
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ambang Batas Pelanggaran</CardTitle>
            <CardDescription>Dihitung dari pelanggaran dalam bulan kalender berjalan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {numberField("sp1_threshold", "Ambang SP 1", "Jumlah pelanggaran dalam 1 bulan sebelum SP 1 diterbitkan.", "pelanggaran")}
            {numberField("sp2_threshold", "Ambang SP 2", "Jumlah pelanggaran dalam 1 bulan sebelum SP 2 diterbitkan.", "pelanggaran")}
            {numberField("lock_threshold", "Ambang Lock Akun", "Jumlah pelanggaran dalam 1 bulan sebelum akun absensi dikunci.", "pelanggaran")}
            {numberField(
              "three_month_warning_threshold",
              "Ambang Peringatan Dini 3 Bulan",
              "Total pelanggaran dalam 3 bulan kalender berjalan. Hanya peringatan dini, tidak menerbitkan SP.",
              "pelanggaran"
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Alasan Terlambat & Notifikasi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {numberField(
              "late_reason_deadline_hours",
              "Batas Waktu Pengajuan Alasan",
              "Batas waktu karyawan mengajukan alasan keterlambatan setelah kejadian.",
              "jam"
            )}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5 pr-4">
                <Label>Notifikasi Progres Pelanggaran</Label>
                <p className="text-xs text-muted-foreground">
                  Kirim pemberitahuan ke karyawan setiap pelanggaran bertambah dalam bulan berjalan.
                </p>
              </div>
              <Switch
                checked={config.enable_progress_notifications}
                onCheckedChange={(v) => setConfig({ ...config, enable_progress_notifications: v })}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-muted/40">
          <CardContent className="pt-6 flex gap-3">
            <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground">
              Terlambat dengan alasan yang disetujui tetap tercatat sebagai keterlambatan, tetapi tidak dihitung
              sebagai pelanggaran. Riwayat pelanggaran tidak dihapus saat penghitungan bulanan dimulai ulang.
            </p>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Simpan Pengaturan
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
