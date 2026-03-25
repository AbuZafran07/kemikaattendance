import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Plus, X, Building2, Briefcase, Save, Loader2 } from "lucide-react";
import { JABATAN_OPTIONS as DEFAULT_JABATAN, DEPARTMENT_OPTIONS as DEFAULT_DEPT } from "@/lib/employeeOptions";

interface DeptJabatanConfig {
  departments: string[];
  jabatan: string[];
}

export default function DepartmentJabatanSettings() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [departments, setDepartments] = useState<string[]>([...DEFAULT_DEPT]);
  const [jabatan, setJabatan] = useState<string[]>([...DEFAULT_JABATAN]);
  const [newDept, setNewDept] = useState("");
  const [newJabatan, setNewJabatan] = useState("");

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "department_jabatan_config")
        .maybeSingle();

      if (data?.value) {
        const config = data.value as unknown as DeptJabatanConfig;
        if (config.departments?.length) setDepartments(config.departments);
        if (config.jabatan?.length) setJabatan(config.jabatan);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const config: DeptJabatanConfig = { departments, jabatan };
      const { data: existing } = await supabase
        .from("system_settings")
        .select("id")
        .eq("key", "department_jabatan_config")
        .maybeSingle();

      if (existing) {
        await supabase
          .from("system_settings")
          .update({ value: config as any, updated_at: new Date().toISOString() })
          .eq("key", "department_jabatan_config");
      } else {
        await supabase
          .from("system_settings")
          .insert({
            key: "department_jabatan_config",
            value: config as any,
            description: "Daftar departemen dan jabatan perusahaan",
          });
      }
      toast.success("Pengaturan berhasil disimpan");
    } catch (err) {
      toast.error("Gagal menyimpan pengaturan");
    } finally {
      setIsSaving(false);
    }
  };

  const addDept = () => {
    const trimmed = newDept.trim();
    if (!trimmed) return;
    if (departments.includes(trimmed)) {
      toast.error("Departemen sudah ada");
      return;
    }
    setDepartments([...departments, trimmed]);
    setNewDept("");
  };

  const removeDept = (dept: string) => {
    setDepartments(departments.filter((d) => d !== dept));
  };

  const addJabatan = () => {
    const trimmed = newJabatan.trim();
    if (!trimmed) return;
    if (jabatan.includes(trimmed)) {
      toast.error("Jabatan sudah ada");
      return;
    }
    setJabatan([...jabatan, trimmed]);
    setNewJabatan("");
  };

  const removeJabatan = (j: string) => {
    setJabatan(jabatan.filter((item) => item !== j));
  };

  if (isLoading) {
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
      <div className="space-y-4 sm:space-y-6 animate-fadeIn">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/settings")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Departemen & Jabatan</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Kelola daftar departemen dan jabatan perusahaan
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Departemen */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4 text-primary" />
                Departemen ({departments.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Nama departemen baru..."
                  value={newDept}
                  onChange={(e) => setNewDept(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addDept()}
                />
                <Button size="sm" onClick={addDept} className="shrink-0">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 max-h-[300px] overflow-y-auto">
                {departments.map((dept) => (
                  <Badge
                    key={dept}
                    variant="secondary"
                    className="text-sm py-1.5 px-3 flex items-center gap-1.5"
                  >
                    {dept}
                    <button
                      onClick={() => removeDept(dept)}
                      className="ml-1 hover:text-destructive transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Jabatan */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Briefcase className="h-4 w-4 text-primary" />
                Jabatan ({jabatan.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Nama jabatan baru..."
                  value={newJabatan}
                  onChange={(e) => setNewJabatan(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addJabatan()}
                />
                <Button size="sm" onClick={addJabatan} className="shrink-0">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 max-h-[300px] overflow-y-auto">
                {jabatan.map((j) => (
                  <Badge
                    key={j}
                    variant="secondary"
                    className="text-sm py-1.5 px-3 flex items-center gap-1.5"
                  >
                    {j}
                    <button
                      onClick={() => removeJabatan(j)}
                      className="ml-1 hover:text-destructive transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => navigate("/dashboard/settings")}>
            Batal
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Simpan Pengaturan
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
