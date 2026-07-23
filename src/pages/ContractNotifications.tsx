import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, Bell, PlayCircle } from "lucide-react";
import { toast } from "sonner";

const statusFor = (endDate: string | null) => {
  if (!endDate) return { label: "—", variant: "outline" as const };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { label: `Expired (${Math.abs(diff)}h lalu)`, variant: "destructive" as const };
  if (diff <= 7) return { label: `H-${diff}`, variant: "destructive" as const };
  if (diff <= 30) return { label: `H-${diff}`, variant: "default" as const };
  return { label: `${diff} hari lagi`, variant: "secondary" as const };
};

export default function ContractNotifications() {
  const [active, setActive] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: emps }, { data: reminderLogs }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, nik, jabatan, departemen, contract_number, contract_type, contract_start_date, contract_end_date, email")
        .eq("status", "Active")
        .not("contract_end_date", "is", null)
        .order("contract_end_date", { ascending: true }),
      supabase
        .from("contract_reminders_log")
        .select("*")
        .order("sent_at", { ascending: false })
        .limit(200),
    ]);

    const upcoming = (emps || []).filter((e: any) => {
      if (!e.contract_end_date) return false;
      const diff = Math.ceil(
        (new Date(e.contract_end_date).getTime() - new Date(today).getTime()) / 86400000
      );
      return diff <= 60;
    });

    // Enrich logs with employee name
    const empMap = new Map((emps || []).map((e: any) => [e.id, e]));
    const enrichedLogs = (reminderLogs || []).map((l: any) => ({
      ...l,
      employee: empMap.get(l.employee_id),
    }));

    setActive(upcoming);
    setLogs(enrichedLogs);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const runNow = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("contract-reminder-scheduler");
      if (error) throw error;
      toast.success(`Scheduler dijalankan. ${data?.processed || 0} reminder dikirim.`);
      await load();
    } catch (e: any) {
      toast.error(`Gagal: ${e.message}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bell className="h-6 w-6" /> Notifikasi Kontrak
            </h1>
            <p className="text-sm text-muted-foreground">
              Reminder otomatis H-30 & H-7 untuk kontrak karyawan yang akan berakhir.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Muat Ulang
            </Button>
            <Button onClick={runNow} disabled={running}>
              <PlayCircle className="h-4 w-4 mr-2" />
              {running ? "Menjalankan..." : "Jalankan Sekarang"}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="upcoming">
          <TabsList>
            <TabsTrigger value="upcoming">Kontrak Aktif ({active.length})</TabsTrigger>
            <TabsTrigger value="logs">Riwayat Reminder ({logs.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="mt-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Kontrak Akan Berakhir (≤ 60 hari)</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Karyawan</TableHead>
                      <TableHead>Jabatan</TableHead>
                      <TableHead>No. Kontrak</TableHead>
                      <TableHead>Tipe</TableHead>
                      <TableHead>Berakhir</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {active.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                          Tidak ada kontrak yang akan berakhir dalam 60 hari.
                        </TableCell>
                      </TableRow>
                    )}
                    {active.map((e) => {
                      const s = statusFor(e.contract_end_date);
                      return (
                        <TableRow key={e.id}>
                          <TableCell className="font-medium">{e.full_name}</TableCell>
                          <TableCell>{e.jabatan || "—"}</TableCell>
                          <TableCell>{e.contract_number || "—"}</TableCell>
                          <TableCell>{e.contract_type || "—"}</TableCell>
                          <TableCell>{e.contract_end_date}</TableCell>
                          <TableCell>
                            <Badge variant={s.variant}>{s.label}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="mt-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Log Pengiriman Reminder</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Waktu Kirim</TableHead>
                      <TableHead>Karyawan</TableHead>
                      <TableHead>Tipe</TableHead>
                      <TableHead>Tgl Kontrak Berakhir</TableHead>
                      <TableHead>Kanal</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                          Belum ada log reminder.
                        </TableCell>
                      </TableRow>
                    )}
                    {logs.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>{new Date(l.sent_at).toLocaleString("id-ID")}</TableCell>
                        <TableCell>{l.employee?.full_name || l.employee_id}</TableCell>
                        <TableCell>
                          <Badge variant={l.reminder_type === "EXPIRED" ? "destructive" : "default"}>
                            {l.reminder_type}
                          </Badge>
                        </TableCell>
                        <TableCell>{l.contract_end_date}</TableCell>
                        <TableCell className="text-xs">
                          {l.channels?.fcm && <Badge variant="outline" className="mr-1">FCM</Badge>}
                          {l.channels?.email && <Badge variant="outline">Email</Badge>}
                        </TableCell>
                        <TableCell>
                          <Badge variant={l.status === "sent" ? "default" : "destructive"}>
                            {l.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
