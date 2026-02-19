import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Loader2, Save, Info, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AllowanceConfig {
  max_amount: number;
  work_hours_per_day: number;
  excluded_employee_ids: string[];
  enabled: boolean;
}

const DEFAULT_CONFIG: AllowanceConfig = {
  max_amount: 500000,
  work_hours_per_day: 8,
  excluded_employee_ids: [],
  enabled: true,
};

interface EmployeeOption {
  id: string;
  full_name: string;
  jabatan: string;
  departemen: string;
}

export default function AttendanceAllowanceSettings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<AllowanceConfig>(DEFAULT_CONFIG);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchSettings();
    fetchEmployees();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "attendance_allowance")
        .maybeSingle();

      if (data?.value) {
        setConfig({ ...DEFAULT_CONFIG, ...(data.value as any) });
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, jabatan, departemen")
      .order("full_name");
    if (data) setEmployees(data);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("system_settings")
        .select("id")
        .eq("key", "attendance_allowance")
        .maybeSingle();

      if (existing) {
        await supabase
          .from("system_settings")
          .update({ value: config as any, updated_at: new Date().toISOString() })
          .eq("key", "attendance_allowance");
      } else {
        await supabase.from("system_settings").insert({
          key: "attendance_allowance",
          value: config as any,
          description: "Konfigurasi tunjangan kehadiran",
        });
      }

      toast.success("Pengaturan tunjangan kehadiran berhasil disimpan");
    } catch (error) {
      toast.error("Gagal menyimpan pengaturan");
    } finally {
      setSaving(false);
    }
  };

  const toggleExcluded = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      excluded_employee_ids: prev.excluded_employee_ids.includes(id)
        ? prev.excluded_employee_ids.filter((eid) => eid !== id)
        : [...prev.excluded_employee_ids, id],
    }));
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val);

  const filteredEmployees = employees.filter(
    (e) =>
      e.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.jabatan.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const excludedEmployees = employees.filter((e) => config.excluded_employee_ids.includes(e.id));

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fadeIn">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/settings")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Tunjangan Kehadiran</h1>
            <p className="text-muted-foreground text-sm">Konfigurasi perhitungan tunjangan kehadiran karyawan</p>
          </div>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Formula:</strong> Tunjangan = (Maks ÷ Hari Kerja × Hari Hadir) - (Σ ceil(menit terlambat ÷ 60) × Maks ÷ Hari Kerja ÷ Jam Kerja/hari). 
            Keterlambatan dihitung setelah batas check-in + toleransi. 1 menit terlambat = 1 jam potongan.
          </AlertDescription>
        </Alert>

        {/* Pengaturan Umum */}
        <Card>
          <CardHeader>
            <CardTitle>Pengaturan Umum</CardTitle>
            <CardDescription>Konfigurasi dasar tunjangan kehadiran</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Aktifkan Tunjangan Kehadiran</Label>
                <p className="text-xs text-muted-foreground">Mengaktifkan fitur perhitungan tunjangan</p>
              </div>
              <Switch
                checked={config.enabled}
                onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, enabled: checked }))}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nilai Maksimal Tunjangan (per bulan)</Label>
                <Input
                  type="number"
                  value={config.max_amount}
                  onChange={(e) => setConfig((prev) => ({ ...prev, max_amount: Number(e.target.value) }))}
                />
                <p className="text-xs text-muted-foreground">{formatCurrency(config.max_amount)}</p>
              </div>
              <div className="space-y-2">
                <Label>Jam Kerja per Hari</Label>
                <Input
                  type="number"
                  value={config.work_hours_per_day}
                  onChange={(e) => setConfig((prev) => ({ ...prev, work_hours_per_day: Number(e.target.value) }))}
                />
                <p className="text-xs text-muted-foreground">Digunakan untuk menghitung tarif potongan per jam</p>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-1 text-sm">
              <p><strong>Contoh Perhitungan (22 hari kerja):</strong></p>
              <p>• Tarif per hari: {formatCurrency(config.max_amount / 22)}</p>
              <p>• Tarif potongan per jam terlambat: {formatCurrency(config.max_amount / 22 / config.work_hours_per_day)}</p>
              <p>• Hadir 20 hari, terlambat 2x (masing-masing 30 menit = 1 jam):</p>
              <p className="ml-4">Base = {formatCurrency((config.max_amount / 22) * 22)} - Potongan = {formatCurrency((config.max_amount / 22 / config.work_hours_per_day) * 2)} = {formatCurrency(config.max_amount - (config.max_amount / 22 / config.work_hours_per_day) * 2)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Karyawan Dikecualikan */}
        <Card>
          <CardHeader>
            <CardTitle>Karyawan Dikecualikan</CardTitle>
            <CardDescription>Karyawan yang tidak mendapat tunjangan kehadiran</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Already excluded */}
            {excludedEmployees.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {excludedEmployees.map((emp) => (
                  <Badge key={emp.id} variant="secondary" className="flex items-center gap-1 py-1">
                    {emp.full_name} - {emp.jabatan}
                    <button onClick={() => toggleExcluded(emp.id)}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <Label>Cari Karyawan</Label>
              <Input
                placeholder="Cari berdasarkan nama atau jabatan..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {searchTerm && (
              <div className="max-h-48 overflow-y-auto border rounded-md divide-y">
                {filteredEmployees.map((emp) => {
                  const isExcluded = config.excluded_employee_ids.includes(emp.id);
                  return (
                    <div
                      key={emp.id}
                      className="flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer"
                      onClick={() => toggleExcluded(emp.id)}
                    >
                      <div>
                        <p className="text-sm font-medium">{emp.full_name}</p>
                        <p className="text-xs text-muted-foreground">{emp.jabatan} - {emp.departemen}</p>
                      </div>
                      <Switch checked={isExcluded} />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => navigate("/dashboard/settings")}>Batal</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Simpan Pengaturan
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
