import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Plus, Trash2, CalendarClock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface SpecialPeriod {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  check_in_start: string;
  check_in_end: string;
  check_out_start: string;
  check_out_end: string;
  late_tolerance_minutes: number;
  early_leave_tolerance_minutes: number;
  is_active: boolean;
}

const generateId = () => Math.random().toString(36).substring(2, 10);

const createEmptyPeriod = (): SpecialPeriod => ({
  id: generateId(),
  name: "",
  start_date: "",
  end_date: "",
  check_in_start: "00:00",
  check_in_end: "07:30",
  check_out_start: "15:00",
  check_out_end: "23:59",
  late_tolerance_minutes: 15,
  early_leave_tolerance_minutes: 0,
  is_active: true,
});

export default function SpecialWorkHoursSettings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [periods, setPeriods] = useState<SpecialPeriod[]>([]);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "special_work_hours")
        .maybeSingle();

      if (error) throw error;

      if (data?.value) {
        const val = data.value as any;
        setPeriods(val.periods || []);
      }
    } catch (error) {
      console.error("Error fetching special work hours:", error);
      toast({
        title: "Gagal Memuat Data",
        description: "Tidak dapat memuat pengaturan jam kerja khusus",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    // Validate
    for (const p of periods) {
      if (!p.name.trim()) {
        toast({ title: "Validasi Gagal", description: "Nama periode harus diisi", variant: "destructive" });
        return;
      }
      if (!p.start_date || !p.end_date) {
        toast({ title: "Validasi Gagal", description: `Tanggal periode "${p.name}" harus diisi`, variant: "destructive" });
        return;
      }
      if (p.start_date > p.end_date) {
        toast({ title: "Validasi Gagal", description: `Tanggal mulai harus sebelum tanggal selesai pada "${p.name}"`, variant: "destructive" });
        return;
      }
    }

    setIsSaving(true);
    try {
      const value = { periods };

      const { data: existingData } = await supabase
        .from("system_settings")
        .select("id")
        .eq("key", "special_work_hours")
        .maybeSingle();

      if (existingData) {
        const { error } = await supabase
          .from("system_settings")
          .update({ value: value as any, updated_at: new Date().toISOString() })
          .eq("key", "special_work_hours");
        if (error) throw error;
      } else {
        const { error } = await supabase.from("system_settings").insert({
          key: "special_work_hours",
          value: value as any,
          description: "Pengaturan jam kerja khusus (Ramadhan, event, dll)",
        });
        if (error) throw error;
      }

      toast({ title: "Berhasil Disimpan", description: "Pengaturan jam kerja khusus telah diperbarui" });
    } catch (error) {
      console.error("Error saving:", error);
      toast({ title: "Gagal Menyimpan", description: "Tidak dapat menyimpan pengaturan", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const addPeriod = () => setPeriods([...periods, createEmptyPeriod()]);

  const removePeriod = (id: string) => setPeriods(periods.filter((p) => p.id !== id));

  const updatePeriod = (id: string, field: keyof SpecialPeriod, value: any) => {
    setPeriods(periods.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const getPeriodStatus = (p: SpecialPeriod) => {
    const today = new Date().toISOString().split("T")[0];
    if (!p.is_active) return { label: "Nonaktif", variant: "secondary" as const };
    if (!p.start_date || !p.end_date) return { label: "Belum diatur", variant: "outline" as const };
    if (today >= p.start_date && today <= p.end_date) return { label: "Sedang Berlaku", variant: "default" as const };
    if (today < p.start_date) return { label: "Akan Datang", variant: "outline" as const };
    return { label: "Sudah Lewat", variant: "secondary" as const };
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex items-center gap-2 sm:gap-3 px-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10" onClick={() => navigate("/dashboard/settings")}>
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-3xl font-bold tracking-tight">Jam Kerja Khusus</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
              Atur jam kerja khusus untuk periode tertentu (Ramadhan, event, dll)
            </p>
          </div>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-muted-foreground text-center">Memuat pengaturan...</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Info Card */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">
                  <strong>Cara kerja:</strong> Saat tanggal hari ini masuk dalam periode aktif, sistem absensi otomatis menggunakan jam kerja khusus. 
                  Setelah periode selesai, jam kerja kembali normal tanpa perlu diubah manual.
                </p>
              </CardContent>
            </Card>

            {/* Periods */}
            {periods.map((period, index) => {
              const status = getPeriodStatus(period);
              return (
                <Card key={period.id}>
                  <CardHeader className="p-4 sm:p-6">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                        <CalendarClock className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
                        Periode {index + 1}
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </CardTitle>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`active-${period.id}`} className="text-sm">Aktif</Label>
                          <Switch
                            id={`active-${period.id}`}
                            checked={period.is_active}
                            onCheckedChange={(v) => updatePeriod(period.id, "is_active", v)}
                          />
                        </div>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removePeriod(period.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <CardDescription className="text-xs sm:text-sm">Konfigurasi jam kerja untuk periode khusus</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6 pt-0 sm:pt-0">
                    {/* Name & Dates */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Nama Periode</Label>
                        <Input
                          placeholder="Contoh: Ramadhan 2026"
                          value={period.name}
                          onChange={(e) => updatePeriod(period.id, "name", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Tanggal Mulai</Label>
                        <Input
                          type="date"
                          value={period.start_date}
                          onChange={(e) => updatePeriod(period.id, "start_date", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Tanggal Selesai</Label>
                        <Input
                          type="date"
                          value={period.end_date}
                          onChange={(e) => updatePeriod(period.id, "end_date", e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Check-in settings */}
                    <div className="space-y-3">
                      <h3 className="font-semibold text-sm sm:text-base">Jam Masuk</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Waktu Mulai Check-In</Label>
                          <Input
                            type="time"
                            value={period.check_in_start}
                            onChange={(e) => updatePeriod(period.id, "check_in_start", e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Batas Waktu Check-In</Label>
                          <Input
                            type="time"
                            value={period.check_in_end}
                            onChange={(e) => updatePeriod(period.id, "check_in_end", e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Toleransi Keterlambatan (menit)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="60"
                          value={period.late_tolerance_minutes}
                          onChange={(e) => updatePeriod(period.id, "late_tolerance_minutes", parseInt(e.target.value) || 0)}
                        />
                      </div>
                    </div>

                    {/* Check-out settings */}
                    <div className="space-y-3">
                      <h3 className="font-semibold text-sm sm:text-base">Jam Pulang</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Waktu Mulai Check-Out</Label>
                          <Input
                            type="time"
                            value={period.check_out_start}
                            onChange={(e) => updatePeriod(period.id, "check_out_start", e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Batas Waktu Check-Out</Label>
                          <Input
                            type="time"
                            value={period.check_out_end}
                            onChange={(e) => updatePeriod(period.id, "check_out_end", e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Toleransi Pulang Cepat (menit)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="60"
                          value={period.early_leave_tolerance_minutes}
                          onChange={(e) => updatePeriod(period.id, "early_leave_tolerance_minutes", parseInt(e.target.value) || 0)}
                        />
                      </div>
                    </div>

                    {/* Preview */}
                    <div className="bg-muted/50 p-3 sm:p-4 rounded-lg space-y-2">
                      <h4 className="font-semibold text-xs sm:text-sm">Ringkasan:</h4>
                      <ul className="text-xs sm:text-sm text-muted-foreground space-y-1">
                        <li>• Jam masuk: <strong>{period.check_in_end}</strong> (toleransi {period.late_tolerance_minutes} menit)</li>
                        <li>• Jam pulang: <strong>{period.check_out_start}</strong> (toleransi {period.early_leave_tolerance_minutes} menit)</li>
                        {period.start_date && period.end_date && (
                          <li>• Periode: <strong>{new Date(period.start_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</strong> s/d <strong>{new Date(period.end_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</strong></li>
                        )}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* Add & Save buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button variant="outline" onClick={addPeriod} className="gap-2">
                <Plus className="h-4 w-4" />
                Tambah Periode Baru
              </Button>
              <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                <Save className="h-4 w-4" />
                {isSaving ? "Menyimpan..." : "Simpan Semua Pengaturan"}
              </Button>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
