import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Props { employeeId: string; }

export const EmployeeAssets = ({ employeeId }: Props) => {
  const [rows, setRows] = useState<any[]>([]);
  const [assets, setAssets] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!employeeId) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("asset_assignments" as any)
        .select("*")
        .eq("employee_id", employeeId)
        .order("assigned_at", { ascending: false });
      const list = ((data as any[]) || []);
      setRows(list);
      const ids = Array.from(new Set(list.map((r) => r.asset_id)));
      if (ids.length) {
        const { data: a } = await supabase.from("assets" as any).select("*").in("id", ids);
        const map: Record<string, any> = {};
        ((a as any[]) || []).forEach((x) => { map[x.id] = x; });
        setAssets(map);
      }
      setLoading(false);
    })();
  }, [employeeId]);

  if (loading) return <p className="text-sm text-muted-foreground">Memuat...</p>;
  if (rows.length === 0) return <p className="text-sm text-muted-foreground text-center py-6">Belum ada aset yang pernah dipegang.</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Aset</TableHead><TableHead>Periode</TableHead>
          <TableHead>Kondisi</TableHead><TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => {
          const a = assets[r.asset_id];
          const active = !r.returned_at;
          return (
            <TableRow key={r.id}>
              <TableCell>
                {a ? <><div className="font-medium">{a.name}</div><div className="text-xs text-muted-foreground">{a.asset_code} · {a.category}</div></> : "-"}
              </TableCell>
              <TableCell className="text-xs">
                {new Date(r.assigned_at).toLocaleDateString("id-ID")} → {r.returned_at ? new Date(r.returned_at).toLocaleDateString("id-ID") : "sekarang"}
              </TableCell>
              <TableCell className="text-xs">{r.condition_out || "-"}{r.condition_in ? ` → ${r.condition_in}` : ""}</TableCell>
              <TableCell><Badge variant={active ? "default" : "secondary"}>{active ? "Dipegang" : "Dikembalikan"}</Badge></TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

export default EmployeeAssets;
