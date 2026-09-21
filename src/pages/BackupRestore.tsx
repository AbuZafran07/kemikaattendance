import { useState, useRef, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { toast } from "sonner";
import {
  CloudUpload, Download, Upload, RefreshCw, CheckCircle2, AlertCircle,
  Trash2, FileJson, Clock, CalendarClock, RotateCcw, HardDriveUpload, PlugZap, FileSpreadsheet,
  History as HistoryIcon

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

interface GdriveConfig {
  enabled: boolean;
  include_files: boolean;
  last_backup_at: string | null;
  last_backup_file: string | null;
  last_backup_records: number;
  files_uploaded?: number;
  files_failed?: number;
  files_folder?: string | null;
  files_done?: boolean;
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

// Urutan restore: induk dulu, baru anak (hindari error foreign key)
const RESTORE_ORDER: BackupDataKey[] = [
  "profiles",
  "payroll_periods",
  "employee_loans",
  "attendance",
  "leave_requests",
  "overtime_requests",
  "business_travel_requests",
  "payroll",
  "payroll_overrides",
  "loan_installments",
];

// Ambil SEMUA baris (default PostgREST hanya 1000 baris)
async function fetchAllRows(table: BackupDataKey): Promise<Record<string, unknown>[]> {
  const PAGE = 1000;
  let from = 0;
  let all: Record<string, unknown>[] = [];
  while (true) {
    const { data, error } = await supabase.from(table).select("*").range(from, from + PAGE - 1);
    if (error) throw new Error(`Gagal ambil ${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    all = all.concat(data as Record<string, unknown>[]);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

type AuditAction = "RESTORE_BACKUP" | "DELETE_BACKUP" | "CREATE_BACKUP" | "EXPORT_EXCEL" | "PRE_RESTORE_SNAPSHOT";

const AUDIT_LABELS: Record<AuditAction, string> = {
  RESTORE_BACKUP: "Restore backup",
  DELETE_BACKUP: "Hapus backup",
  CREATE_BACKUP: "Buat backup",
  EXPORT_EXCEL: "Export Excel",
  PRE_RESTORE_SNAPSHOT: "Snapshot pra-restore",
};

interface BackupAuditLog {
  id: string;
  action_type: string;
  file_name: string;
  records: number;
  notes: string | null;
  created_at: string;
  performed_by: string;
}



async function logBackupAudit(
  action: "RESTORE_BACKUP" | "DELETE_BACKUP" | "CREATE_BACKUP" | "EXPORT_EXCEL",
  fileName: string,
  records: number,
  tables?: string[],
) {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) return;
    await supabase.from("backup_audit_logs").insert({
      action_type: action,
      file_name: fileName,
      records,
      tables_affected: tables ?? null,
      performed_by: uid,
      notes: `${AUDIT_LABELS[action]}: ${fileName} (${records} records)`,
    });
  } catch (e) {
    console.error("Gagal mencatat audit log backup:", e);
  }
}

// Snapshot pengaman sebelum restore — dibuat server-side (edge function) + retensi otomatis
async function createPreRestoreSnapshot(): Promise<string> {
  const { data, error } = await supabase.functions.invoke("pre-restore-snapshot");
  if (error) {
    let msg = error.message;
    if (error instanceof FunctionsHttpError) {
      try {
        const body = await error.context.json() as { error?: string };
        msg = body.error || msg;
      } catch { /* ignore */ }
    }
    throw new Error(`Snapshot pengaman gagal: ${msg}`);
  }
  const result = data as { file_name?: string } | null;
  if (!result?.file_name) throw new Error("Snapshot pengaman gagal dibuat");
  return result.file_name;
}


function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}


function getBackupType(name: string): string {
  if (name.startsWith("scheduled-backup-")) return "Terjadwal";
  if (name.startsWith("auto-backup-")) return "Manual Cloud";
  if (name.startsWith("pre-restore-backup-")) return "Pra-Restore";
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
  const [auditLogs, setAuditLogs] = useState<BackupAuditLog[]>([]);
  const [auditNames, setAuditNames] = useState<Record<string, string>>({});
  const [loadingAudit, setLoadingAudit] = useState(true);

  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [restoringFile, setRestoringFile] = useState<string | null>(null);
  const [gdriveConfig, setGdriveConfig] = useState<GdriveConfig>({
    enabled: false,
    include_files: false,
    last_backup_at: null,
    last_backup_file: null,
    last_backup_records: 0,
  });
  const [exportingExcel, setExportingExcel] = useState(false);
  const [selectedExcelTables, setSelectedExcelTables] = useState<Set<BackupDataKey>>(
    new Set(BACKUP_OPTIONS.map((o) => o.key))
  );

  const [gdriveLoading, setGdriveLoading] = useState(false);
  const [gdriveTesting, setGdriveTesting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingRestoreFile, setPendingRestoreFile] = useState<File | null>(null);
  const [confirmLocalRestore, setConfirmLocalRestore] = useState(false);


  const getFunctionErrorMessage = async (error: unknown, fallback: string) => {
    if (error instanceof FunctionsHttpError) {
      try {
        const body = await error.context.json() as { error?: string };
        return body.error || fallback;
      } catch {
        return fallback;
      }
    }
    return error instanceof Error ? error.message : fallback;
  };

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

  const fetchGdriveConfig = useCallback(async () => {
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "gdrive_backup_config")
      .maybeSingle();
    const v = (data?.value ?? null) as unknown as GdriveConfig | null;
    if (v) {
      setGdriveConfig({
        enabled: !!v.enabled,
        include_files: !!v.include_files,
        last_backup_at: v.last_backup_at ?? null,
        last_backup_file: v.last_backup_file ?? null,
        last_backup_records: v.last_backup_records ?? 0,
        files_uploaded: v.files_uploaded ?? 0,
        files_failed: v.files_failed ?? 0,
        files_folder: v.files_folder ?? null,
        files_done: v.files_done ?? false,
      });

    }
  }, []);

  const fetchAuditLogs = useCallback(async () => {
    setLoadingAudit(true);
    try {
      const { data, error } = await supabase
        .from("backup_audit_logs")
        .select("id, action_type, file_name, records, notes, created_at, performed_by")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      const logs = (data ?? []) as BackupAuditLog[];
      setAuditLogs(logs);

      const ids = [...new Set(logs.map((l) => l.performed_by))];
      if (ids.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
        const map: Record<string, string> = {};
        (profs ?? []).forEach((p) => { map[p.id] = p.full_name; });
        setAuditNames(map);
      }
    } catch {
      /* audit log opsional, tidak perlu ganggu user */
    } finally {
      setLoadingAudit(false);
    }
  }, []);

  useEffect(() => {
    fetchBackupFiles();
    fetchGdriveConfig();
    fetchAuditLogs();
  }, [fetchBackupFiles, fetchGdriveConfig, fetchAuditLogs]);


  // Backup file berjalan di background (bertahap) — polling progres tiap 10 detik
  const filesInProgress =
    gdriveConfig.include_files && !!gdriveConfig.files_folder && !gdriveConfig.files_done;
  useEffect(() => {
    if (!filesInProgress) return;
    const id = setInterval(() => { fetchGdriveConfig(); }, 10000);
    return () => clearInterval(id);
  }, [filesInProgress, fetchGdriveConfig]);

  // Simpan hanya field yang berubah agar progres backup file tidak tertimpa
  const patchGdriveSetting = async (patch: Record<string, unknown>) => {
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "gdrive_backup_config")
      .maybeSingle();
    const current = (data?.value ?? {}) as Record<string, unknown>;
    return supabase
      .from("system_settings")
      .update({ value: { ...current, ...patch } as never })
      .eq("key", "gdrive_backup_config");

  };

  const handleToggleGdrive = async (enabled: boolean) => {
    setGdriveConfig((prev) => ({ ...prev, enabled }));
    const { error } = await patchGdriveSetting({ enabled });
    if (error) {
      setGdriveConfig((prev) => ({ ...prev, enabled: !enabled }));
      toast.error("Gagal memperbarui pengaturan Google Drive backup");
      return;
    }
    toast.success(enabled ? "Google Drive backup diaktifkan" : "Google Drive backup dinonaktifkan");
  };

  const handleToggleIncludeFiles = async (include: boolean) => {
    setGdriveConfig((prev) => ({ ...prev, include_files: include }));
    const { error } = await patchGdriveSetting({ include_files: include });
    if (error) {
      setGdriveConfig((prev) => ({ ...prev, include_files: !include }));
      toast.error("Gagal memperbarui pengaturan backup file");
      return;
    }
    toast.success(include ? "File akan disertakan ke Google Drive" : "Backup hanya data database");
  };



  const toggleExcelTable = (key: BackupDataKey) => {
    setSelectedExcelTables((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleExportExcel = async () => {
    if (selectedExcelTables.size === 0) {
      toast.error("Pilih minimal satu data untuk diexport");
      return;
    }
    setExportingExcel(true);
    try {
      const tables = BACKUP_OPTIONS.filter((o) => selectedExcelTables.has(o.key));
      const results = await Promise.all(
        tables.map(async (t) => {
          const rows = await fetchAllRows(t.key);
          return { ...t, rows };

        })
      );

      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();

      // Sheet Index
      const indexSheet = workbook.addWorksheet("Index");
      const indexHeader = indexSheet.addRow(["No", "Tabel", "Jumlah Record"]);
      indexHeader.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF008751" } };
      });
      results.forEach((r, i) => indexSheet.addRow([i + 1, r.label, r.rows.length]));
      indexSheet.columns.forEach((col, i) => {
        col.width = i === 1 ? 30 : 16;
      });

      const isDateKey = (k: string) => k.includes("_at") || k.includes("_date");
      const usedNames = new Set<string>(["Index"]);

      for (const r of results) {
        let name = r.label.replace(/[*?:\\/[\]]/g, "").slice(0, 31);
        let n = 1;
        while (usedNames.has(name)) {
          const suffix = `_${++n}`;
          name = `${r.label.slice(0, 31 - suffix.length)}${suffix}`;
        }
        usedNames.add(name);
        const sheet = workbook.addWorksheet(name);

        if (r.rows.length === 0) {
          sheet.addRow(["Tidak ada data"]);
          sheet.columns[0].width = 20;
          continue;
        }

        const columns = Object.keys(r.rows[0]);
        const headerRow = sheet.addRow(columns);
        headerRow.eachCell((cell) => {
          cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF008751" } };
        });

        for (const row of r.rows) {
          sheet.addRow(
            columns.map((c) => {
              const value = row[c];
              if (value === null || value === undefined) return "";
              if (isDateKey(c) && typeof value === "string") {
                const d = new Date(value);
                if (!isNaN(d.getTime())) {
                  return d.toLocaleString("id-ID", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                }
                return value;
              }
              if (typeof value === "object") return JSON.stringify(value);
              return value as string | number | boolean;
            })
          );
        }

        sheet.columns.forEach((col) => {
          let maxLen = 10;
          col.eachCell?.({ includeEmpty: false }, (cell) => {
            const len = String(cell.value ?? "").length;
            if (len > maxLen) maxLen = len;
          });
          col.width = Math.min(maxLen + 2, 40);
        });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Kemika-Attendance-Export-${new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, 19)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Export Excel berhasil: ${results.length} tabel`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal export ke Excel");
    } finally {
      setExportingExcel(false);
    }
  };


  const handleRunGdriveBackup = async () => {
    setGdriveLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("gdrive-backup", { body: {} });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      const res = data as {
        file?: string;
        total_records?: number;
        message?: string;
        files_backup_started?: boolean;
      };
      if (res.message) toast.info(res.message);
      else {
        toast.success(`Backup database berhasil: ${res.total_records ?? 0} records`);
        if (res.files_backup_started) {
          toast.info("Backup file berjalan di latar belakang — progres akan diperbarui otomatis.", {
            duration: 8000,
          });
        }
      }
      await fetchGdriveConfig();

    } catch (err: unknown) {
      toast.error(await getFunctionErrorMessage(err, "Gagal backup ke Google Drive"), { duration: 10000 });
    } finally {
      setGdriveLoading(false);
    }
  };

  const handleTestGdrive = async () => {
    setGdriveTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("gdrive-backup", {
        body: { test: true },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      const res = data as { folder_name?: string };
      toast.success(`Koneksi Drive OK — folder: ${res.folder_name ?? "-"}`);
    } catch (err: unknown) {
      toast.error(await getFunctionErrorMessage(err, "Koneksi Google Drive gagal"), { duration: 10000 });
    } finally {
      setGdriveTesting(false);
    }
  };


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
        backupData[table] = await fetchAllRows(table);
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
        backupData[table] = await fetchAllRows(table);
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

  // Restore inti: snapshot pengaman -> upsert urut induk->anak -> audit log
  const runRestore = async (backup: {
    version?: string;
    app?: string;
    tables?: string[];
    data?: Record<string, unknown>;
  }, sourceName: string) => {
    if (!backup.version || !backup.data || !backup.tables) {
      throw new Error("Format file backup tidak valid");
    }
    if (backup.app !== "Kemika Attendance") {
      throw new Error("File backup bukan dari aplikasi Kemika Attendance");
    }

    // Snapshot pengaman WAJIB berhasil
    const snapshotName = await createPreRestoreSnapshot();
    toast.success("Snapshot pengaman dibuat sebelum restore", { description: snapshotName });

    let restoredCount = 0;
    const errors: string[] = [];
    for (const table of RESTORE_ORDER) {
      if (!backup.tables.includes(table)) continue;
      const rows = (backup.data as Record<string, unknown>)[table];
      if (!rows || !Array.isArray(rows) || rows.length === 0) continue;
      const { error } = await supabase.from(table).upsert(rows, { onConflict: "id" });
      if (error) errors.push(`${table}: ${error.message}`);
      else restoredCount += rows.length;
    }

    await logBackupAudit("RESTORE_BACKUP", sourceName, restoredCount);

    if (errors.length > 0) {
      toast.warning(`Restore selesai dengan ${errors.length} error. ${restoredCount} records berhasil.`);
      console.error("Restore errors:", errors);
    } else {
      toast.success(`Restore berhasil! ${restoredCount} records dipulihkan.`);
    }
    fetchBackupFiles();
    fetchAuditLogs();

  };

  const handleRestoreFromCloud = async (fileName: string) => {
    setRestoringFile(fileName);
    try {
      const { data, error } = await supabase.storage.from("backups").download(fileName);
      if (error) throw error;
      const backup = JSON.parse(await data.text());
      await runRestore(backup, fileName);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal restore dari cloud");
    } finally {
      setRestoringFile(null);
    }
  };

  const handleDeleteBackup = async (fileName: string) => {
    setDeletingFile(fileName);
    try {
      const { error } = await supabase.storage.from("backups").remove([fileName]);
      if (error) throw error;
      await logBackupAudit("DELETE_BACKUP", fileName, 0);
      toast.success("Backup berhasil dihapus");
      fetchBackupFiles();
      fetchAuditLogs();

    } catch {
      toast.error("Gagal menghapus backup");
    } finally {
      setDeletingFile(null);
    }
  };

  const handleSelectRestoreFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPendingRestoreFile(file);
    setConfirmLocalRestore(true);
  };

  const handleRestore = async () => {
    const file = pendingRestoreFile;
    if (!file) return;
    setConfirmLocalRestore(false);
    setIsRestoring(true);
    try {
      const backup = JSON.parse(await file.text());
      await runRestore(backup, file.name);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal restore data");
    } finally {
      setIsRestoring(false);
      setPendingRestoreFile(null);
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

        {/* Google Drive Backup */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1.5">
                <CardTitle className="flex flex-wrap items-center gap-2 text-lg sm:text-xl">
                  <HardDriveUpload className="h-5 w-5 text-primary" />
                  Google Drive Backup
                  <Badge variant={gdriveConfig.enabled ? "default" : "secondary"}>
                    {gdriveConfig.enabled ? "AKTIF" : "NONAKTIF"}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Backup otomatis ke Google Drive setiap malam pukul 01.00 WIB tanpa perlu PC menyala
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground sm:hidden">Aktifkan</span>
                <Switch
                  checked={gdriveConfig.enabled}
                  onCheckedChange={handleToggleGdrive}
                  aria-label="Aktifkan Google Drive backup"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {gdriveConfig.last_backup_at ? (
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                  Backup terakhir: {new Date(gdriveConfig.last_backup_at).toLocaleString("id-ID")}
                </div>
                <p className="text-xs text-muted-foreground break-all pl-6">
                  {gdriveConfig.last_backup_file} · {gdriveConfig.last_backup_records.toLocaleString("id-ID")} records
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                Belum ada backup ke Google Drive.
              </div>
            )}
            {gdriveConfig.include_files && !!gdriveConfig.files_folder && (
              <p className="text-xs text-muted-foreground pl-6 break-all flex items-center gap-1.5">
                {!gdriveConfig.files_done && <RefreshCw className="h-3 w-3 animate-spin flex-shrink-0" />}
                File: {(gdriveConfig.files_uploaded ?? 0).toLocaleString("id-ID")} terunggah
                {(gdriveConfig.files_failed ?? 0) > 0 ? ` · ${gdriveConfig.files_failed} gagal` : ""}
                {gdriveConfig.files_done ? " · selesai" : " · sedang berjalan"}
                {gdriveConfig.files_folder ? ` · folder ${gdriveConfig.files_folder}` : ""}
              </p>
            )}
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <label htmlFor="gdrive-include-files" className="text-sm cursor-pointer">
                  Sertakan file (foto absensi, foto karyawan, dokumen dinas) — hanya backup mingguan
                </label>
                <Switch
                  id="gdrive-include-files"
                  checked={gdriveConfig.include_files}
                  onCheckedChange={handleToggleIncludeFiles}
                  aria-label="Sertakan file ke Google Drive"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Jadwal otomatis: <strong>harian 01:00 WIB → JSON database saja</strong>,
                <strong> Minggu 01:00 WIB → JSON + file storage</strong>. Backup manual selalu
                menyertakan file jika toggle aktif. File diunggah bertahap di latar belakang ·
                Retensi: 30 file JSON &amp; 7 folder file terakhir
              </p>

            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5 flex-shrink-0" />
              Jadwal: Setiap hari pukul 01.00 WIB · Retensi: 30 file terakhir
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={handleRunGdriveBackup} disabled={gdriveLoading || gdriveTesting}>
                {gdriveLoading ? (
                  <><RefreshCw className="h-4 w-4 animate-spin" /> Memproses...</>
                ) : (
                  <><HardDriveUpload className="h-4 w-4" /> Jalankan Backup Sekarang</>
                )}
              </Button>
              <Button variant="secondary" onClick={handleTestGdrive} disabled={gdriveLoading || gdriveTesting}>
                {gdriveTesting ? (
                  <><RefreshCw className="h-4 w-4 animate-spin" /> Menguji...</>
                ) : (
                  <><PlugZap className="h-4 w-4" /> Test Koneksi Drive</>
                )}
              </Button>
            </div>
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
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Restore"
                            disabled={restoringFile === file.name}
                          >
                            {restoringFile === file.name ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <RotateCcw className="h-4 w-4 text-primary" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Restore dari Backup Cloud?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Data akan dipulihkan dari <strong>{file.name}</strong>. Data yang sudah ada akan diperbarui (upsert). Lanjutkan?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleRestoreFromCloud(file.name)}>
                              Restore
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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

        {/* Export ke Excel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Export ke Excel
            </CardTitle>
            <CardDescription>
              Download data sebagai file .xlsx yang bisa langsung dibuka di Microsoft Excel / Google Sheets
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm font-medium">Pilih data yang akan diexport:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {BACKUP_OPTIONS.map((option) => (
                <label key={option.key} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={selectedExcelTables.has(option.key)}
                    onCheckedChange={() => toggleExcelTable(option.key)}
                  />
                  <span className="text-sm">{option.label}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedExcelTables(new Set(BACKUP_OPTIONS.map((o) => o.key)))}
              >
                Pilih Semua
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedExcelTables(new Set())}>
                Hapus Semua
              </Button>
            </div>
            <Button onClick={handleExportExcel} disabled={exportingExcel || selectedExcelTables.size === 0}>
              {exportingExcel ? (
                <><RefreshCw className="h-4 w-4 animate-spin" /> Memproses...</>
              ) : (
                <><FileSpreadsheet className="h-4 w-4" /> Download Excel</>
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
              onChange={handleSelectRestoreFile}
              className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
            />
            {pendingRestoreFile && (
              <p className="text-xs text-muted-foreground">
                File dipilih: {pendingRestoreFile.name}
              </p>
            )}
            <div className="border-t border-border pt-3">
              <Button variant="secondary" disabled={isRestoring} onClick={() => fileInputRef.current?.click()}>
                {isRestoring ? (
                  <><RefreshCw className="h-4 w-4 animate-spin" /> Memulihkan...</>
                ) : (
                  <><Upload className="h-4 w-4" /> Restore Data</>
                )}
              </Button>
            </div>

            <AlertDialog
              open={confirmLocalRestore}
              onOpenChange={(open) => {
                setConfirmLocalRestore(open);
                if (!open) {
                  setPendingRestoreFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }
              }}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Konfirmasi Restore Data</AlertDialogTitle>
                  <AlertDialogDescription>
                    Data akan dipulihkan dari file <strong>{pendingRestoreFile?.name}</strong>.
                    Data saat ini akan di-snapshot terlebih dahulu ke bucket backup sebagai pengaman.
                    Lanjutkan?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Batal</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRestore}>Ya, Restore</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

          </CardContent>
        </Card>

        {/* Riwayat Aktivitas Backup */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1.5">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <HistoryIcon className="h-5 w-5 text-primary" />
                  Riwayat Aktivitas Backup
                </CardTitle>
                <CardDescription>
                  Catatan restore, hapus backup, dan snapshot pra-restore (30 aktivitas terakhir)
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={fetchAuditLogs} disabled={loadingAudit}>
                <RefreshCw className={`h-4 w-4 ${loadingAudit ? "animate-spin" : ""}`} /> Muat Ulang
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingAudit ? (
              <p className="text-sm text-muted-foreground">Memuat riwayat...</p>
            ) : auditLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada aktivitas backup yang tercatat.</p>
            ) : (
              <div className="space-y-2">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex flex-col gap-1 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={log.action_type === "RESTORE_BACKUP" ? "default" : "secondary"}>
                          {AUDIT_LABELS[log.action_type as AuditAction] ?? log.action_type}
                        </Badge>
                        <span className="break-all text-xs font-medium sm:text-sm">{log.file_name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {log.records > 0 ? `${log.records.toLocaleString("id-ID")} records · ` : ""}
                        oleh {auditNames[log.performed_by] ?? "—"}
                      </p>
                    </div>
                    <span className="whitespace-nowrap text-xs text-muted-foreground">
                      {log.created_at ? new Date(log.created_at).toLocaleString("id-ID") : "-"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </DashboardLayout>
  );
}
