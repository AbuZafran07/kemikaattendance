import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { HolidayManager, Holiday } from "@/components/HolidayManager";
import { CompanyEventManager } from "@/components/CompanyEventManager";

export default function HolidayEventSettings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [originalConfig, setOriginalConfig] = useState<any>(null);

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

      if (data?.value) {
        const val = data.value as any;
        setHolidays(val.holidays || []);
        setOriginalConfig(val);
      }
    } catch (error) {
      console.error("Error fetching holidays:", error);
      toast({
        title: "Gagal Memuat Data",
        description: "Tidak dapat memuat daftar hari libur",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updatedConfig = { ...(originalConfig || {}), holidays };

      const { data: existingData } = await supabase
        .from("system_settings")
        .select("id")
        .eq("key", "overtime_policy")
        .maybeSingle();

      if (existingData) {
        const { error } = await supabase
          .from("system_settings")
          .update({
            value: updatedConfig,
            updated_at: new Date().toISOString(),
          })
          .eq("key", "overtime_policy");
        if (error) throw error;
      } else {
        const { error } = await supabase.from("system_settings").insert({
          key: "overtime_policy",
          value: updatedConfig,
          description: "Konfigurasi kebijakan lembur",
        });
        if (error) throw error;
      }

      toast({
        title: "Berhasil Disimpan",
        description: "Daftar hari libur telah diperbarui",
      });
    } catch (error: any) {
      toast({
        title: "Gagal Menyimpan",
        description: error.message || "Terjadi kesalahan saat menyimpan",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6 animate-fadeIn">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/settings")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Hari Libur & Event Kantor</h1>
            <p className="text-sm text-muted-foreground mt-1">Kelola daftar hari libur nasional dan event kegiatan kantor</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <>
            {/* Hari Libur Nasional */}
            <HolidayManager
              holidays={holidays}
              onHolidaysChange={setHolidays}
            />

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => navigate("/dashboard/settings")}>
                Batal
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? "Menyimpan..." : "Simpan Hari Libur"}
              </Button>
            </div>

            {/* Event & Kegiatan Kantor */}
            <CompanyEventManager />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
