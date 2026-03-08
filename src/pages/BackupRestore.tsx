import { useState, useRef, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  CloudUpload, Download, Upload, RefreshCw, CheckCircle2, AlertCircle,
  Trash2, FileJson, Clock, CalendarClock, RotateCcw
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";

type BackupDataKey = "profiles" | "attendance" | "leave_requests" | "overtime_requests" | "business_travel_requests" | "payroll" | "payroll_periods" | "payroll_overrides" | "employee_loans" | "loan_installments";

interface BackupFile {
  name: string;
  created_at: string;
  metadata: { size: number } | null;
}

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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getBackupType(name: string): string {
  if (name.startsWith("scheduled-backup-")) return "Terjadwal";
  if (name.startsWith("auto-backup-")) return "Manual Cloud";
  return "Lainnya";
}

export default function BackupRestore() {
  const [selectedTables, setSelectedTables] = useState<BackupDataKey[]>(
    BACKUP_OPTIONS.map((o) => o.key)
  );
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [backupFiles, setBackupFiles] = useState<BackupFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [restoringFile, setRestoringFile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchBackupFiles = useCallback(async () => {
    setLoadingFiles(true);
    try {
      const { data, error } = await supabase.storage
        .from("backups")
        .list("", { sortBy: { column: "created_at", order: "desc" } });

      if (error) throw error;
      setBackupFiles(
        (data || []).map((f) => ({
          name: f.name,
          created_at: f.created_at || "",
          metadata: f.metadata as { size: number } | null,
        }))
      );
    } catch {
      toast.error("Gagal memuat daftar backup");
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  useEffect(() => {
    fetchBackupFiles();
  }, [fetchBackupFiles]);

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
      toast.error(err instanceof Error ? err.message : "Gagal melakukan backup");
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
      toast.success("Backup Cloud berhasil disimpan!");
      fetchBackupFiles();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal melakukan backup");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadBackup = async (fileName: string) => {
    try {
      const { data, error } = await supabase.storage.from("backups").download(fileName);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Gagal mengunduh file backup");
    }
  };

  const handleDeleteBackup = async (fileName: string) => {
    setDeletingFile(fileName);
    try {
      const { error } = await supabase.storage.from("backups").remove([fileName]);
      if (error) throw error;
      toast.success("Backup berhasil dihapus");
      fetchBackupFiles();
    } catch {
      toast.error("Gagal menghapus backup");
    } finally {
      setDeletingFile(null);
    }
  };

  const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsRestoring(true);
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      if (!backup.version || !backup.data || !backup.tables) throw new Error("Format file backup tidak valid");
      if (backup.app !== "Kemika Attendance") throw new Error("File backup bukan dari aplikasi Kemika Attendance");

      let restoredCount = 0;
      const errors: string[] = [];
      for (const table of backup.tables as string[]) {
        const rows = backup.data[table];
        if (!rows || !Array.isArray(rows) || rows.length === 0) continue;
        const { error } = await supabase.from(table as BackupDataKey).upsert(rows, { onConflict: "id" });
        if (error) errors.push(`${table}: ${error.message}`);
        else restoredCount += rows.length;
      }
      if (errors.length > 0) {
        toast.warning(`Restore selesai dengan ${errors.length} error. ${restoredCount} records berhasil.`);
        console.error("Restore errors:", errors);
      } else {
        toast.success(`Restore berhasil! ${restoredCount} records dipulihkan.`);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal restore data");
    } finally {
      setIsRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const latestScheduled = backupFiles.find((f) => f.name.startsWith("scheduled-backup-"));

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
              Backup otomatis berjalan setiap minggu (Minggu 02:00 UTC) dan menyimpan 4 backup terakhir
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {latestScheduled ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Backup terjadwal terakhir: {new Date(latestScheduled.created_at).toLocaleString("id-ID")}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4 text-destructive" />
                Belum ada backup terjadwal. Backup pertama akan dibuat pada jadwal berikutnya.
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" />
              Jadwal: Setiap hari Minggu pukul 02:00 UTC · Retensi: 4 backup terakhir
            </div>
            <Button onClick={handleAutoBackupCloud} disabled={isExporting}>
              {isExporting ? (
                <><RefreshCw className="h-4 w-4 animate-spin" /> Memproses...</>
              ) : (
                <><CloudUpload className="h-4 w-4" /> Backup ke Cloud Sekarang</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Riwayat Backup Cloud */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Clock className="h-5 w-5 text-primary" />
              Riwayat Backup Cloud
            </CardTitle>
            <CardDescription>
              Daftar backup yang tersimpan di cloud storage
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingFiles ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <RefreshCw className="h-4 w-4 animate-spin" /> Memuat daftar backup...
              </div>
            ) : backupFiles.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Belum ada backup cloud tersimpan.</p>
            ) : (
              <div className="space-y-2">
                {backupFiles.map((file) => (
                  <div
                    key={file.name}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-muted/30"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileJson className="h-5 w-5 text-primary flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-xs px-1.5 py-0">
                            {getBackupType(file.name)}
                          </Badge>
                          <span>{file.created_at ? new Date(file.created_at).toLocaleString("id-ID") : "-"}</span>
                          {file.metadata?.size && (
                            <span>· {formatFileSize(file.metadata.size)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDownloadBackup(file.name)}
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" title="Hapus" disabled={deletingFile === file.name}>
                            {deletingFile === file.name ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4 text-destructive" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Hapus Backup?</AlertDialogTitle>
                            <AlertDialogDescription>
                              File <strong>{file.name}</strong> akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteBackup(file.name)}>
                              Hapus
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
                <label key={option.key} className="flex items-center gap-2 cursor-pointer">
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
