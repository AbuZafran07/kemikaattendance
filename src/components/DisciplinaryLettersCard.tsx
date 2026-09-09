import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileWarning, Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ensureWarningLetterDocument } from "@/lib/warningLetterStorage";
import type { WarningLetterData } from "@/lib/warningLetterPdfGenerator";

interface DisciplinaryLettersCardProps {
  userId: string;
  /** Optional pre-known employee identity (skips profile fetch). */
  employeeName?: string;
}

interface ActionRow {
  id: string;
  warning_type: string;
  period_month: string;
  violation_count_at_issuance: number;
  issue_date: string;
  status: string;
  document_url: string | null;
}

const MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const periodLabel = (value: string) => {
  const d = new Date(value);
  return `${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
};

const DisciplinaryLettersCard = ({ userId, employeeName }: DisciplinaryLettersCardProps) => {
  const { toast } = useToast();
  const [actions, setActions] = useState<ActionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchActions = useCallback(async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from("disciplinary_actions")
      .select("id, warning_type, period_month, violation_count_at_issuance, issue_date, status, document_url")
      .eq("user_id", userId)
      .order("issue_date", { ascending: false });
    setActions((data as ActionRow[]) || []);
    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  const handleDownload = async (action: ActionRow) => {
    setBusyId(action.id);
    try {
      const [{ data: profile }, config] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, nik, jabatan, departemen")
          .eq("id", userId)
          .maybeSingle(),
        supabase.rpc("get_attendance_discipline_config"),
      ]);

      const letterData: WarningLetterData = {
        id: action.id,
        warning_type: action.warning_type,
        period_month: action.period_month,
        violation_count_at_issuance: action.violation_count_at_issuance,
        issue_date: action.issue_date,
        employee_name: profile?.full_name || employeeName || "-",
        nik: profile?.nik,
        jabatan: profile?.jabatan,
        departemen: profile?.departemen,
        monthly_threshold:
          action.warning_type === "sp2"
            ? (config.data as { sp2_monthly_threshold?: number } | null)?.sp2_monthly_threshold
            : (config.data as { sp1_monthly_threshold?: number } | null)?.sp1_monthly_threshold,
      };

      const url = await ensureWarningLetterDocument(userId, letterData, action.document_url);
      if (!url) throw new Error("Dokumen tidak dapat dibuat");

      window.open(url, "_blank", "noopener,noreferrer");
      await fetchActions();
    } catch (error) {
      toast({
        title: "Gagal Membuka Surat",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  if (!isLoading && actions.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileWarning className="h-5 w-5" />
          Surat Peringatan
        </CardTitle>
        <CardDescription>Dokumen SP resmi yang diterbitkan sistem</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          actions.map((action) => (
            <div
              key={action.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant={action.warning_type === "sp2" ? "destructive" : "secondary"}>
                    {action.warning_type.toUpperCase()}
                  </Badge>
                  {action.status !== "active" && <Badge variant="outline">Tidak Aktif</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  Periode {periodLabel(action.period_month)} • {action.violation_count_at_issuance} pelanggaran
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={busyId === action.id}
                onClick={() => handleDownload(action)}
              >
                {busyId === action.id ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-1" />
                )}
                Unduh PDF
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default DisciplinaryLettersCard;
