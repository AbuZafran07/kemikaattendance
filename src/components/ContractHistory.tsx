import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";

interface ContractHistoryProps {
  employeeId: string;
}

interface ContractHistoryRecord {
  id: string;
  contract_number: string | null;
  contract_type: string | null;
  start_date: string | null;
  end_date: string | null;
  changes: Record<string, { old: any; new: any }> | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
}

const fieldLabel: Record<string, string> = {
  contract_number: "No. Kontrak",
  contract_type: "Tipe Kontrak",
  start_date: "Tgl Mulai",
  end_date: "Tgl Berakhir",
};

const fmt = (v: any) => (v == null || v === "" ? "—" : String(v));

export const ContractHistory = ({ employeeId }: ContractHistoryProps) => {
  const [rows, setRows] = useState<ContractHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("contract_history")
        .select("*")
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false });
      setRows((data as any) || []);
      setLoading(false);
    })();
  }, [employeeId]);

  if (loading) return <p className="text-sm text-muted-foreground">Memuat riwayat kontrak...</p>;
  if (rows.length === 0)
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Belum ada riwayat perubahan kontrak.</p>
      </div>
    );

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.id} className="border border-border rounded-lg p-3 bg-card">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-muted-foreground">
              {new Date(r.created_at).toLocaleString("id-ID")}
            </div>
            <Badge variant="outline" className="text-[10px]">
              {r.contract_type || "—"}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs mb-2">
            <div>
              <span className="text-muted-foreground">No: </span>
              <span className="font-medium">{fmt(r.contract_number)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Periode: </span>
              <span className="font-medium">
                {fmt(r.start_date)} → {fmt(r.end_date)}
              </span>
            </div>
          </div>
          {r.changes && Object.keys(r.changes).length > 0 && (
            <div className="mt-2 pt-2 border-t border-border/50 space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase">Perubahan</p>
              {Object.entries(r.changes).map(([field, diff]) => (
                <div key={field} className="text-xs flex flex-wrap gap-1">
                  <span className="font-medium">{fieldLabel[field] || field}:</span>
                  <span className="text-red-600 line-through">{fmt(diff.old)}</span>
                  <span>→</span>
                  <span className="text-green-700 font-medium">{fmt(diff.new)}</span>
                </div>
              ))}
            </div>
          )}
          {r.notes && <p className="text-xs mt-2 italic text-muted-foreground">{r.notes}</p>}
        </div>
      ))}
    </div>
  );
};
