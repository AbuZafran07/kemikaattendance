import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Plus, Trash2, Building2, Briefcase, Save, Loader2, Pencil, Check, X } from "lucide-react";
import { JABATAN_OPTIONS as DEFAULT_JABATAN, DEPARTMENT_OPTIONS as DEFAULT_DEPT } from "@/lib/employeeOptions";

interface DeptJabatanConfig {
  departments: string[];
  jabatan: string[];
}

function EditableList({
  items,
  onUpdate,
  placeholder,
}: {
  items: string[];
  onUpdate: (items: string[]) => void;
  placeholder: string;
}) {
  const [newItem, setNewItem] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  const addItem = () => {
    const trimmed = newItem.trim();
    if (!trimmed) return;
    if (items.includes(trimmed)) {
      toast.error("Item sudah ada");
      return;
    }
    onUpdate([...items, trimmed]);
    setNewItem("");
  };

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setEditValue(items[index]);
  };

  const confirmEdit = () => {
    if (editingIndex === null) return;
    const trimmed = editValue.trim();
    if (!trimmed) {
      toast.error("Nama tidak boleh kosong");
      return;
    }
    if (items.some((item, i) => i !== editingIndex && item === trimmed)) {
      toast.error("Item sudah ada");
      return;
    }
    const updated = [...items];
    updated[editingIndex] = trimmed;
    onUpdate(updated);
    setEditingIndex(null);
    setEditValue("");
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditValue("");
  };

  const removeItem = (index: number) => {
    onUpdate(items.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          placeholder={placeholder}
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addItem()}
        />
        <Button size="sm" onClick={addItem} className="shrink-0">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="border rounded-lg divide-y max-h-[400px] overflow-y-auto">
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">Belum ada data</p>
        )}
        {items.map((item, index) => (
          <div
            key={index}
            className="flex items-center gap-2 px-3 py-2 group hover:bg-muted/50 transition-colors"
          >
            {editingIndex === index ? (
              <>
                <span className="text-xs text-muted-foreground w-6 text-center">{index + 1}.</span>
                <Input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmEdit();
                    if (e.key === "Escape") cancelEdit();
                  }}
                  className="h-8 text-sm flex-1"
                  autoFocus
                />
                <Button size="icon" variant="ghost" className="h-7 w-7 text-primary" onClick={confirmEdit}>
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : (
              <>
                <span className="text-xs text-muted-foreground w-6 text-center">{index + 1}.</span>
                <span className="text-sm flex-1">{item}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => startEdit(index)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                  onClick={() => removeItem(index)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DepartmentJabatanSettings() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [departments, setDepartments] = useState<string[]>([...DEFAULT_DEPT]);
  const [jabatan, setJabatan] = useState<string[]>([...DEFAULT_JABATAN]);

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
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4 text-primary" />
                Departemen ({departments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EditableList
                items={departments}
                onUpdate={setDepartments}
                placeholder="Nama departemen baru..."
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Briefcase className="h-4 w-4 text-primary" />
                Jabatan ({jabatan.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EditableList
                items={jabatan}
                onUpdate={setJabatan}
                placeholder="Nama jabatan baru..."
              />
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
