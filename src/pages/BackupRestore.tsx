import { useState, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CloudUpload, Download, Upload, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";

type BackupDataKey = "profiles" | "attendance" | "leave_requests" | "overtime_requests" | "business_travel_requests" | "payroll" | "payroll_periods" | "payroll_overrides" | "employee_loans" | "loan_installments";

const BACKUP_OPTIONS: { key: BackupDataKey; label: string }[] = [
  { key: "profiles", label: "Data Karyawan" },
  { key: "attendance", label: "Data Absensi" },
  { key: "leave_requests", label: "Pengajuan Cuti" },
  { key: "overtime_requests", label: "Pengajuan Lembur" },
  { key: "business_travel_requests", label: "Perjalanan Dinas" },
  { key: "payroll_periods", label: "Periode Payroll" },
  { key: "payroll", label: "Data Payroll" },
  { key: "payroll_overrides", label: "Override Payroll" },
  { key: "employee_loans", label: "Pinjaman Karyawan" },
  { key: "loan_installments", label: "Cicilan Pinjaman" },
];

export default function BackupRestore() {
  const [selectedTables, setSelectedTables] = useState<BackupDataKey[]>(
    BACKUP_OPTIONS.map((o) => o.key)
  );
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [lastAutoBackup, setLastAutoBackup] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleTable = (key: BackupDataKey) => {
    setSelectedTables((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleExport = async () => {
    if (selectedTables.length === 0) {
      toast.error("Pilih minimal satu data untuk di-backup");
      return;
    }

    setIsExporting(true);
    try {
      const backupData: Record<string, unknown[]> = {};
      for (const table of selectedTables) {
        const { data, error } = await supabase.from(table).select("*");
        if (error) throw new Error(`Gagal mengambil data ${table}: ${error.message}`);
        backupData[table] = data || [];
      }

      const backup = {
        version: "1.0",
        app: "Kemika Attendance",
        created_at: new Date().toISOString(),
        tables: selectedTables,
        data: backupData,
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kemika-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success("Backup berhasil diunduh!");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal melakukan backup";
      toast.error(message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleAutoBackupCloud = async () => {
    setIsExporting(true);
    try {
      const allTables = BACKUP_OPTIONS.map((o) => o.key);
      const backupData: Record<string, unknown[]> = {};
      for (const table of allTables) {
        const { data, error } = await supabase.from(table).select("*");
        if (error) throw new Error(`Gagal mengambil data ${table}: ${error.message}`);
        backupData[table] = data || [];
      }

      const backup = {
        version: "1.0",
        app: "Kemika Attendance",
        created_at: new Date().toISOString(),
        type: "auto_cloud",
        tables: allTables,
        data: backupData,
      };

      const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
      const fileName = `auto-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

      const { error: uploadError } = await supabase.storage
        .from("backups")
        .upload(fileName, blob, { contentType: "application/json", upsert: false });

      if (uploadError) throw uploadError;

      setLastAutoBackup(new Date().toISOString());
      toast.success("Auto Backup Cloud berhasil disimpan!");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal melakukan auto backup";
      toast.error(message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsRestoring(true);
    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      if (!backup.version || !backup.data || !backup.tables) {
        throw new Error("Format file backup tidak valid");
      }

      if (backup.app !== "Kemika Attendance") {
        throw new Error("File backup bukan dari aplikasi Kemika Attendance");
      }

      let restoredCount = 0;
      const errors: string[] = [];

      for (const table of backup.tables as string[]) {
        const rows = backup.data[table];
        if (!rows || !Array.isArray(rows) || rows.length === 0) continue;

        const { error } = await supabase
          .from(table as BackupDataKey)
          .upsert(rows, { onConflict: "id" });

        if (error) {
          errors.push(`${table}: ${error.message}`);
        } else {
          restoredCount += rows.length;
        }
      }

      if (errors.length > 0) {
        toast.warning(`Restore selesai dengan ${errors.length} error. ${restoredCount} records berhasil.`);
        console.error("Restore errors:", errors);
      } else {
        toast.success(`Restore berhasil! ${restoredCount} records dipulihkan.`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal restore data";
      toast.error(message);
    } finally {
      setIsRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6 animate-fadeIn">
        <div className="px-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Backup & Restore</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Kelola backup dan pemulihan data sistem
          </p>
        </div>

        {/* Auto Backup Cloud */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <CloudUpload className="h-5 w-5 text-primary" />
              Auto Backup Cloud
              <Badge variant="default" className="ml-2">Aktif</Badge>
            </CardTitle>
            <CardDescription>
              Backup otomatis ke cloud storage. Klik tombol untuk membuat backup sekarang.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {lastAutoBackup ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Backup terakhir: {new Date(lastAutoBackup).toLocaleString("id-ID")}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4 text-destructive" />
                Belum ada backup otomatis. Klik tombol di bawah untuk membuat backup pertama.
              </div>
            )}
            <Button onClick={handleAutoBackupCloud} disabled={isExporting}>
              {isExporting ? (
                <><RefreshCw className="h-4 w-4 animate-spin" /> Memproses...</>
              ) : (
                <><CloudUpload className="h-4 w-4" /> Backup ke Cloud Sekarang</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Backup Manual */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Download className="h-5 w-5 text-primary" />
              Backup Manual
            </CardTitle>
            <CardDescription>
              Ekspor data ke file JSON untuk backup lokal
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm font-medium">Pilih data yang akan di-backup:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {BACKUP_OPTIONS.map((option) => (
                <label
                  key={option.key}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedTables.includes(option.key)}
                    onCheckedChange={() => toggleTable(option.key)}
                  />
                  <span className="text-sm">{option.label}</span>
                </label>
              ))}
            </div>
            <Button onClick={handleExport} disabled={isExporting || selectedTables.length === 0}>
              {isExporting ? (
                <><RefreshCw className="h-4 w-4 animate-spin" /> Memproses...</>
              ) : (
                <><Download className="h-4 w-4" /> Download Backup</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Restore Data */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Upload className="h-5 w-5 text-primary" />
              Restore Data
            </CardTitle>
            <CardDescription>
              Impor data dari file backup JSON
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm font-medium">Pilih file backup</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleRestore}
              className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
            />
            <div className="border-t border-border pt-3">
              <Button variant="secondary" disabled={isRestoring} onClick={() => fileInputRef.current?.click()}>
                {isRestoring ? (
                  <><RefreshCw className="h-4 w-4 animate-spin" /> Memulihkan...</>
                ) : (
                  <><Upload className="h-4 w-4" /> Restore Data</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
