import { useState, useRef, useEffect } from "react";
import { getFixedAllowanceComponents, DEFAULT_FIXED_ALLOWANCE_COMPONENTS, type FixedAllowanceComponents } from "@/lib/bpjsFixedComponents";
import ExcelJS from "exceljs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Download,
  Upload,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type FieldDef = {
  key: string;
  label: string;
  type: "string" | "number" | "boolean" | "date";
  financial?: boolean;
};

// Semua field profil yang boleh di-bulk update.
const FIELDS: FieldDef[] = [
  { key: "nik", label: "NIK", type: "string" },
  { key: "full_name", label: "Nama Lengkap", type: "string" },
  { key: "email", label: "Email", type: "string" },
  { key: "phone", label: "No HP", type: "string" },
  { key: "address", label: "Alamat", type: "string" },
  { key: "jabatan", label: "Jabatan", type: "string" },
  { key: "departemen", label: "Departemen", type: "string" },
  { key: "status", label: "Status (Active/Inactive)", type: "string" },
  { key: "work_type", label: "Tipe Kerja (wfo/wfa/hybrid)", type: "string" },
  { key: "contract_type", label: "Kontrak (permanent/contract/probation)", type: "string" },
  { key: "join_date", label: "Tgl Bergabung (YYYY-MM-DD)", type: "date" },
  { key: "resign_date", label: "Tgl Resign (YYYY-MM-DD)", type: "date" },
  { key: "annual_leave_quota", label: "Kuota Cuti Tahunan", type: "number" },
  { key: "remaining_leave", label: "Sisa Cuti", type: "number" },
  { key: "basic_salary", label: "Gaji Pokok", type: "number", financial: true },
  { key: "tunjangan_jabatan", label: "Tunjangan Jabatan", type: "number", financial: true },
  // Tunjangan Komunikasi dipindah ke modul Payroll → Tambahan Penghasilan,
  // tidak lagi diekspor/diimpor sebagai Tunjangan Tetap di Detail Karyawan.
  { key: "tunjangan_operasional", label: "Tunjangan Operasional", type: "number", financial: true },
  { key: "ptkp_status", label: "Status PTKP", type: "string", financial: true },
  { key: "bpjs_kesehatan_enabled", label: "BPJS Kesehatan (true/false)", type: "boolean", financial: true },
  { key: "bpjs_ketenagakerjaan_enabled", label: "BPJS Ketenagakerjaan (true/false)", type: "boolean", financial: true },
  { key: "npwp", label: "NPWP", type: "string", financial: true },
  { key: "bank_name", label: "Nama Bank", type: "string", financial: true },
  { key: "bank_account_number", label: "No Rekening", type: "string", financial: true },
];

const FINANCIAL_KEYS = FIELDS.filter((f) => f.financial).map((f) => f.key);

interface DiffRow {
  id: string;
  nik: string;
  full_name: string;
  changes: { key: string; label: string; oldVal: any; newVal: any }[];
  financialDiff: { changed: string[]; oldValues: Record<string, any>; newValues: Record<string, any> };
  error?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: any[];
  onSuccess: () => void;
}

function normalizeValue(raw: any, type: FieldDef["type"]) {
  if (raw === null || raw === undefined || raw === "") {
    return type === "number" ? 0 : type === "boolean" ? false : "";
  }
  if (type === "number") return Number(raw) || 0;
  if (type === "boolean") {
    const s = String(raw).toLowerCase().trim();
    return s === "true" || s === "1" || s === "ya" || s === "yes";
  }
  if (type === "date") {
    if (raw instanceof Date) return raw.toISOString().split("T")[0];
    const s = String(raw).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
    return s;
  }
  return String(raw).trim();
}

function valuesEqual(a: any, b: any, type: FieldDef["type"]) {
  if (type === "number") return Number(a || 0) === Number(b || 0);
  if (type === "boolean") return !!a === !!b;
  return (a ?? "") === (b ?? "");
}

export const BulkUpdateEmployeesDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  employees,
  onSuccess,
}) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"intro" | "preview">("intro");
  const [reason, setReason] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [diffs, setDiffs] = useState<DiffRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [facFlags, setFacFlags] = useState<FixedAllowanceComponents>(DEFAULT_FIXED_ALLOWANCE_COMPONENTS);

  useEffect(() => {
    if (open) getFixedAllowanceComponents().then(setFacFlags).catch(() => {});
  }, [open]);

  const reset = () => {
    setStep("intro");
    setDiffs([]);
    setReason("");
    setEffectiveDate(new Date().toISOString().split("T")[0]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  // ---- Download Template ----
  const downloadTemplate = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Karyawan");

    const headers = ["id", ...FIELDS.map((f) => f.key)];
    const labels = ["ID (JANGAN DIUBAH)", ...FIELDS.map((f) => f.label)];

    ws.addRow(labels);
    ws.addRow(headers);

    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF166534" },
    };
    ws.getRow(2).font = { italic: true, color: { argb: "FF6B7280" }, size: 10 };
    ws.getRow(2).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF3F4F6" },
    };

    // data rows
    employees.forEach((emp) => {
      const row: any[] = [emp.id];
      FIELDS.forEach((f) => {
        let val = emp[f.key];
        if (f.type === "boolean") val = val ? "true" : "false";
        if (val === null || val === undefined) val = "";
        row.push(val);
      });
      ws.addRow(row);
    });

    ws.columns.forEach((col) => {
      col.width = 20;
    });
    ws.getColumn(1).width = 38;

    // Freeze header
    ws.views = [{ state: "frozen", ySplit: 2 }];

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `template-bulk-update-karyawan-${new Date()
      .toISOString()
      .split("T")[0]}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Template berhasil di-download",
      description: `Berisi ${employees.length} karyawan. Edit di Excel lalu upload kembali.`,
    });
  };

  // ---- Upload & parse ----
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.worksheets[0];

      // Baris 1 = label (display), Baris 2 = key (machine). Data dari baris 3.
      const keyRow = ws.getRow(2);
      const headerKeys: string[] = [];
      keyRow.eachCell({ includeEmpty: true }, (cell) => {
        headerKeys.push(String(cell.value ?? "").trim());
      });

      const idIdx = headerKeys.indexOf("id");
      if (idIdx === -1) {
        throw new Error("Kolom 'id' tidak ditemukan. Gunakan template resmi.");
      }

      const empMap = new Map(employees.map((e) => [e.id, e]));
      const newDiffs: DiffRow[] = [];

      for (let r = 3; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const rowVals: any[] = [];
        row.eachCell({ includeEmpty: true }, (c, idx) => {
          rowVals[idx - 1] = c.value;
        });
        const id = String(rowVals[idIdx] ?? "").trim();
        if (!id) continue;

        const oldEmp = empMap.get(id);
        if (!oldEmp) {
          newDiffs.push({
            id,
            nik: "-",
            full_name: "(tidak ditemukan)",
            changes: [],
            financialDiff: { changed: [], oldValues: {}, newValues: {} },
            error: `Karyawan dengan ID ${id} tidak ditemukan`,
          });
          continue;
        }

        const changes: DiffRow["changes"] = [];
        const finOld: Record<string, any> = {};
        const finNew: Record<string, any> = {};
        const finChanged: string[] = [];
        let rowError: string | undefined;

        for (const f of FIELDS) {
          const idx = headerKeys.indexOf(f.key);
          if (idx === -1) continue;
          const rawNew = rowVals[idx];
          const newVal = normalizeValue(rawNew, f.type);
          const oldVal =
            f.type === "boolean"
              ? !!oldEmp[f.key]
              : f.type === "number"
              ? Number(oldEmp[f.key] || 0)
              : oldEmp[f.key] ?? "";

          if (!valuesEqual(oldVal, newVal, f.type)) {
            changes.push({ key: f.key, label: f.label, oldVal, newVal });
            if (f.financial) {
              finChanged.push(f.key);
            }
          }
          if (f.financial) {
            finOld[f.key] = oldVal;
            finNew[f.key] = newVal;
          }
        }

        // Validasi komposisi 75/25 — hanya komponen yang ditandai sebagai "tunjangan tetap"
        // pada Pengaturan BPJS (fixed_allowance_components) yang dihitung.
        const bs = Number(finNew.basic_salary ?? oldEmp.basic_salary ?? 0);
        const tt =
          (facFlags.jabatan ? Number(finNew.tunjangan_jabatan ?? oldEmp.tunjangan_jabatan ?? 0) : 0) +
          (facFlags.operasional ? Number(finNew.tunjangan_operasional ?? oldEmp.tunjangan_operasional ?? 0) : 0);
        if (bs > 0 && tt > 0 && bs < 0.75 * (bs + tt)) {
          rowError = `Komposisi gaji melanggar UU 13/2003: Gapok harus ≥ 75% dari (Gapok+Tunjangan Tetap). Saat ini ${(
            (bs / (bs + tt)) *
            100
          ).toFixed(1)}%`;
        }

        if (changes.length > 0 || rowError) {
          newDiffs.push({
            id,
            nik: oldEmp.nik,
            full_name: oldEmp.full_name,
            changes,
            financialDiff: { changed: finChanged, oldValues: finOld, newValues: finNew },
            error: rowError,
          });
        }
      }

      setDiffs(newDiffs);
      setStep("preview");

      if (newDiffs.length === 0) {
        toast({
          title: "Tidak ada perubahan",
          description: "File yang di-upload identik dengan data saat ini.",
        });
      }
    } catch (err: any) {
      toast({
        title: "Gagal membaca file",
        description: err?.message ?? "File Excel tidak valid",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ---- Apply ----
  const applyChanges = async () => {
    if (reason.trim().length < 5) {
      toast({
        title: "Alasan wajib diisi",
        description: "Minimal 5 karakter (contoh: 'Kenaikan gaji tahunan 2026').",
        variant: "destructive",
      });
      return;
    }
    const validDiffs = diffs.filter((d) => !d.error && d.changes.length > 0);
    if (validDiffs.length === 0) {
      toast({ title: "Tidak ada perubahan valid untuk diterapkan", variant: "destructive" });
      return;
    }

    setIsApplying(true);
    const { data: userData } = await supabase.auth.getUser();
    const changedBy = userData?.user?.id;
    if (!changedBy) {
      toast({ title: "Sesi habis, silakan login ulang", variant: "destructive" });
      setIsApplying(false);
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const d of validDiffs) {
      const updatePayload: Record<string, any> = {};
      for (const c of d.changes) {
        updatePayload[c.key] = c.newVal === "" ? null : c.newVal;
      }

      const { error: updateErr } = await supabase
        .from("profiles")
        .update(updatePayload)
        .eq("id", d.id);

      if (updateErr) {
        failCount++;
        continue;
      }

      // Insert salary history bila ada perubahan finansial
      if (d.financialDiff.changed.length > 0) {
        await supabase.from("salary_change_history").insert({
          user_id: d.id,
          changed_by: changedBy,
          reason: `[Bulk Update] ${reason.trim()}`,
          effective_date: effectiveDate,
          changed_fields: d.financialDiff.changed,
          old_values: d.financialDiff.oldValues,
          new_values: d.financialDiff.newValues,
        });
      }
      successCount++;
    }

    setIsApplying(false);
    toast({
      title: "Bulk update selesai",
      description: `${successCount} berhasil${failCount > 0 ? `, ${failCount} gagal` : ""}.`,
      variant: failCount > 0 ? "destructive" : "default",
    });
    onSuccess();
    handleClose(false);
  };

  const errorRows = diffs.filter((d) => d.error);
  const validRows = diffs.filter((d) => !d.error && d.changes.length > 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Bulk Update Data Karyawan
          </DialogTitle>
          <DialogDescription>
            Update data banyak karyawan sekaligus via template Excel. Perubahan finansial otomatis
            tercatat di Riwayat Gaji.
          </DialogDescription>
        </DialogHeader>

        {step === "intro" && (
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Alur kerja</AlertTitle>
              <AlertDescription>
                <ol className="list-decimal list-inside space-y-1 mt-2 text-sm">
                  <li>Download template (berisi data {employees.length} karyawan saat ini)</li>
                  <li>Edit data di Excel — JANGAN ubah kolom <code>id</code></li>
                  <li>Upload kembali file Excel</li>
                  <li>Review preview perubahan + isi alasan</li>
                  <li>Konfirmasi untuk apply</li>
                </ol>
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Button onClick={downloadTemplate} variant="outline" size="lg" className="h-20">
                <Download className="h-5 w-5 mr-2" />
                <div className="text-left">
                  <div className="font-semibold">1. Download Template</div>
                  <div className="text-xs text-muted-foreground">
                    Excel berisi data karyawan saat ini
                  </div>
                </div>
              </Button>

              <Button
                onClick={() => fileInputRef.current?.click()}
                size="lg"
                className="h-20"
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-5 w-5 mr-2" />
                )}
                <div className="text-left">
                  <div className="font-semibold">2. Upload File Excel</div>
                  <div className="text-xs opacity-80">Sistem akan validasi & preview</div>
                </div>
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>

            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Aturan validasi</AlertTitle>
              <AlertDescription className="text-xs">
                Komposisi Gaji Pokok minimal 75% dari total (Gapok + Tunjangan Tetap) per UU
                13/2003. Baris yang melanggar akan ditandai error & tidak akan diproses.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="default" className="text-sm">
                <CheckCircle2 className="h-3 w-3 mr-1" /> {validRows.length} siap diupdate
              </Badge>
              {errorRows.length > 0 && (
                <Badge variant="destructive" className="text-sm">
                  <AlertTriangle className="h-3 w-3 mr-1" /> {errorRows.length} error
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="bulk-reason">
                  Alasan Perubahan <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="bulk-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Contoh: Kenaikan gaji tahunan 2026 hasil rapat direksi"
                  rows={2}
                />
              </div>
              <div>
                <Label htmlFor="bulk-effective">Tanggal Efektif</Label>
                <Input
                  id="bulk-effective"
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                />
              </div>
            </div>

            <div className="border rounded-md max-h-[400px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead className="w-24">NIK</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Perubahan</TableHead>
                    <TableHead className="w-32">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {diffs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        Tidak ada perubahan terdeteksi
                      </TableCell>
                    </TableRow>
                  )}
                  {diffs.map((d) => (
                    <TableRow key={d.id} className={d.error ? "bg-destructive/5" : ""}>
                      <TableCell className="font-mono text-xs">{d.nik}</TableCell>
                      <TableCell className="text-sm">{d.full_name}</TableCell>
                      <TableCell>
                        {d.error ? (
                          <span className="text-xs text-destructive">{d.error}</span>
                        ) : (
                          <div className="space-y-1">
                            {d.changes.map((c) => (
                              <div key={c.key} className="text-xs">
                                <span className="font-medium">{c.label}:</span>{" "}
                                <span className="text-muted-foreground line-through">
                                  {String(c.oldVal || "-")}
                                </span>{" "}
                                →{" "}
                                <span className="text-primary font-semibold">
                                  {String(c.newVal || "-")}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {d.error ? (
                          <Badge variant="destructive" className="text-xs">
                            Skip
                          </Badge>
                        ) : (
                          <Badge variant="default" className="text-xs">
                            {d.changes.length} field
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={reset} disabled={isApplying}>
                Batal & Ulangi
              </Button>
              <Button
                onClick={applyChanges}
                disabled={isApplying || validRows.length === 0}
              >
                {isApplying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Apply {validRows.length} Perubahan
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
