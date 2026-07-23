import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronDown, ChevronRight, Network, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Emp {
  id: string;
  full_name: string;
  jabatan: string | null;
  departemen: string | null;
  reports_to: string | null;
  photo_url: string | null;
  email: string | null;
  status: string | null;
}

interface Node extends Emp {
  children: Node[];
}

const initials = (n: string) =>
  n.split(" ").map((x) => x[0]).join("").toUpperCase().slice(0, 2);

const buildTree = (list: Emp[]): { roots: Node[]; orphans: Node[] } => {
  const map = new Map<string, Node>();
  list.forEach((e) => map.set(e.id, { ...e, children: [] }));
  const roots: Node[] = [];
  const orphans: Node[] = [];
  map.forEach((n) => {
    if (n.reports_to && map.has(n.reports_to)) {
      map.get(n.reports_to)!.children.push(n);
    } else if (!n.reports_to) {
      roots.push(n);
    } else {
      // reports_to points to unknown (maybe inactive)
      orphans.push(n);
    }
  });
  const sortRec = (n: Node) => {
    n.children.sort((a, b) => a.full_name.localeCompare(b.full_name));
    n.children.forEach(sortRec);
  };
  roots.sort((a, b) => a.full_name.localeCompare(b.full_name));
  roots.forEach(sortRec);
  return { roots, orphans };
};

const NodeCard = ({ node }: { node: Node }) => (
  <div className="inline-flex flex-col items-center min-w-[190px] max-w-[220px] bg-card border border-border rounded-lg p-3 shadow-sm hover:shadow-md transition">
    <Avatar className="h-12 w-12 mb-2">
      <AvatarImage src={node.photo_url || undefined} />
      <AvatarFallback className="bg-primary/10 text-primary text-sm">
        {initials(node.full_name)}
      </AvatarFallback>
    </Avatar>
    <div className="text-center">
      <p className="font-semibold text-sm leading-tight line-clamp-2">{node.full_name}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{node.jabatan || "—"}</p>
      {node.departemen && (
        <Badge variant="outline" className="text-[10px] mt-1">
          {node.departemen}
        </Badge>
      )}
      {node.children.length > 0 && (
        <div className="text-[10px] text-primary mt-1 flex items-center justify-center gap-1">
          <Users className="h-3 w-3" /> {node.children.length} bawahan
        </div>
      )}
    </div>
  </div>
);

const TreeNode = ({ node, level = 0 }: { node: Node; level?: number }) => {
  const [open, setOpen] = useState(level < 2);
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <NodeCard node={node} />
        {node.children.length > 0 && (
          <button
            onClick={() => setOpen(!open)}
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground rounded-full p-0.5 shadow"
            aria-label={open ? "Collapse" : "Expand"}
          >
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        )}
      </div>
      {open && node.children.length > 0 && (
        <>
          <div className="w-px h-6 bg-border mt-3" />
          <div className="flex gap-6 pt-0 relative">
            {node.children.length > 1 && (
              <div className="absolute top-0 left-4 right-4 h-px bg-border" />
            )}
            {node.children.map((c) => (
              <div key={c.id} className="flex flex-col items-center">
                <div className="w-px h-3 bg-border" />
                <TreeNode node={c} level={level + 1} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default function OrgChart() {
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState<string>("all");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, jabatan, departemen, reports_to, photo_url, email, status")
        .eq("status", "Active")
        .order("full_name");
      setEmployees((data as any) || []);
      setLoading(false);
    })();
  }, []);

  const departments = useMemo(
    () => [...new Set(employees.map((e) => e.departemen).filter(Boolean))].sort() as string[],
    [employees],
  );

  const filtered = useMemo(() => {
    let list = employees;
    if (dept !== "all") {
      // include the person and their ancestors when filtering by dept?
      // simple: keep only matching dept
      list = list.filter((e) => e.departemen === dept);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchIds = new Set(
        employees
          .filter((e) => e.full_name.toLowerCase().includes(q) || (e.jabatan || "").toLowerCase().includes(q))
          .map((e) => e.id),
      );
      // include ancestors to preserve hierarchy
      const byId = new Map(employees.map((e) => [e.id, e]));
      const keep = new Set<string>(matchIds);
      matchIds.forEach((id) => {
        let cur = byId.get(id);
        while (cur && cur.reports_to) {
          keep.add(cur.reports_to);
          cur = byId.get(cur.reports_to);
        }
      });
      list = list.filter((e) => keep.has(e.id));
    }
    return list;
  }, [employees, search, dept]);

  const { roots, orphans } = useMemo(() => buildTree(filtered), [filtered]);

  const noReportsToCount = employees.filter((e) => !e.reports_to).length;

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Network className="h-6 w-6" /> Struktur Organisasi
          </h1>
          <p className="text-sm text-muted-foreground">
            Visualisasi hierarki karyawan berdasarkan atasan langsung.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Cari nama atau jabatan..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                className="h-10 px-3 rounded-md border border-input bg-background text-sm"
                value={dept}
                onChange={(e) => setDept(e.target.value)}
              >
                <option value="all">Semua Departemen</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <div className="flex gap-2 text-xs">
                <Badge variant="outline">{employees.length} karyawan aktif</Badge>
                <Badge variant="outline">{noReportsToCount} top-level</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Memuat...</p>
            ) : roots.length === 0 && orphans.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Network className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Tidak ada data untuk ditampilkan.</p>
                <p className="text-xs mt-1">
                  Atur "Atasan Langsung" di halaman Karyawan untuk membangun struktur.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto pb-4">
                <div className="inline-flex flex-col gap-10 min-w-full items-center py-6 px-4">
                  {roots.map((r) => (
                    <TreeNode key={r.id} node={r} />
                  ))}
                </div>
                {orphans.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-dashed">
                    <p className="text-xs font-semibold text-muted-foreground mb-3">
                      ⚠️ Atasan tidak ditemukan (kemungkinan tidak aktif):
                    </p>
                    <div className="flex flex-wrap gap-4">
                      {orphans.map((o) => (
                        <NodeCard key={o.id} node={o} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
