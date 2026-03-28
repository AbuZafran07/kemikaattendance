import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, CalendarDays, Loader2, Pencil, Check, X, FileDown, Upload, FileSpreadsheet } from "lucide-react";
import { exportToExcelFile } from "@/lib/excelExport";
import ExcelJS from "exceljs";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { format, differenceInDays, parseISO } from "date-fns";
import { id } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { notifyAllEmployees, NotificationTemplates, formatDateForNotification } from "@/lib/notifications";

interface CompanyEvent {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
}

export function CompanyEventManager() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [events, setEvents] = useState<CompanyEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newEvent, setNewEvent] = useState({ title: "", description: "", start_date: "", end_date: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", start_date: "", end_date: "" });

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("company_events")
      .select("id, title, description, start_date, end_date")
      .order("start_date", { ascending: true });

    if (!error && data) {
      setEvents(data);
    }
    setIsLoading(false);
  };

  const handleAddEvent = async () => {
    if (!newEvent.title.trim() || !newEvent.start_date || !user) return;
    const endDate = newEvent.end_date || newEvent.start_date;
    if (endDate < newEvent.start_date) {
      toast({ title: "Error", description: "Tanggal selesai tidak boleh sebelum tanggal mulai", variant: "destructive" });
      return;
    }
    setIsSaving(true);

    const { error } = await supabase.from("company_events").insert({
      title: newEvent.title.trim(),
      description: newEvent.description.trim() || null,
      start_date: newEvent.start_date,
      end_date: endDate,
      created_by: user.id,
    });

    if (error) {
      toast({ title: "Gagal menambahkan event", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Berhasil", description: "Event kantor berhasil ditambahkan" });

      const dateLabel = newEvent.start_date === endDate
        ? formatDateForNotification(newEvent.start_date)
        : `${formatDateForNotification(newEvent.start_date)} - ${formatDateForNotification(endDate)}`;
      const { title, body } = NotificationTemplates.companyEventCreated(
        newEvent.title.trim(),
        dateLabel
      );
      notifyAllEmployees(title, body, { type: 'company_event' });

      setNewEvent({ title: "", description: "", start_date: "", end_date: "" });
      fetchEvents();
    }
    setIsSaving(false);
  };

  const handleRemoveEvent = async (eventId: string) => {
    const { error } = await supabase.from("company_events").delete().eq("id", eventId);
    if (error) {
      toast({ title: "Gagal menghapus", description: error.message, variant: "destructive" });
    } else {
      setEvents(events.filter(e => e.id !== eventId));
      toast({ title: "Berhasil", description: "Event berhasil dihapus" });
    }
  };

  const handleStartEdit = (event: CompanyEvent) => {
    setEditingId(event.id);
    setEditForm({
      title: event.title,
      description: event.description || "",
      start_date: event.start_date,
      end_date: event.end_date,
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({ title: "", description: "", start_date: "", end_date: "" });
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editForm.title.trim() || !editForm.start_date) return;
    const endDate = editForm.end_date || editForm.start_date;
    if (endDate < editForm.start_date) {
      toast({ title: "Error", description: "Tanggal selesai tidak boleh sebelum tanggal mulai", variant: "destructive" });
      return;
    }

    const { error } = await supabase
      .from("company_events")
      .update({
        title: editForm.title.trim(),
        description: editForm.description.trim() || null,
        start_date: editForm.start_date,
        end_date: endDate,
      })
      .eq("id", editingId);

    if (error) {
      toast({ title: "Gagal menyimpan", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Berhasil", description: "Event berhasil diperbarui" });
      setEditingId(null);
      setEditForm({ title: "", description: "", start_date: "", end_date: "" });
      fetchEvents();
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd MMM yyyy", { locale: id });
    } catch {
      return dateStr;
    }
  };

  const formatDateRange = (start: string, end: string) => {
    if (start === end) return formatDate(start);
    const days = differenceInDays(parseISO(end), parseISO(start)) + 1;
    return `${formatDate(start)} - ${formatDate(end)} (${days} hari)`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-blue-500" />
          Event & Kegiatan Kantor
        </CardTitle>
        <CardDescription>
          Kelola event kantor seperti meeting, gathering, atau kegiatan lainnya. Event ini akan tampil di kalender dengan warna biru.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add New Event */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="space-y-2">
            <Label htmlFor="event_title">Nama Event</Label>
            <Input
              id="event_title"
              placeholder="contoh: Meeting Bulanan"
              value={newEvent.title}
              onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="event_desc">Keterangan (opsional)</Label>
            <Input
              id="event_desc"
              placeholder="contoh: Ruang meeting lt.3"
              value={newEvent.description}
              onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="event_start">Tanggal Mulai</Label>
            <Input
              id="event_start"
              type="date"
              value={newEvent.start_date}
              onChange={(e) => setNewEvent({ ...newEvent, start_date: e.target.value, end_date: newEvent.end_date || e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="event_end">Tanggal Selesai</Label>
            <Input
              id="event_end"
              type="date"
              value={newEvent.end_date}
              min={newEvent.start_date}
              onChange={(e) => setNewEvent({ ...newEvent, end_date: e.target.value })}
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={handleAddEvent}
              disabled={!newEvent.title.trim() || !newEvent.start_date || isSaving}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Tambah
            </Button>
          </div>
        </div>

        {/* Event List */}
        {isLoading ? (
          <div className="text-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : events.length > 0 ? (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Event</TableHead>
                    <TableHead>Keterangan</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead className="w-24 text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((event) => (
                    <TableRow key={event.id}>
                      {editingId === event.id ? (
                        <>
                          <TableCell>
                            <Input
                              value={editForm.title}
                              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                              className="h-8 text-sm"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={editForm.description}
                              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                              className="h-8 text-sm"
                              placeholder="Keterangan"
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Input
                                type="date"
                                value={editForm.start_date}
                                onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
                                className="h-8 text-sm w-36"
                              />
                              <span className="text-xs text-muted-foreground">-</span>
                              <Input
                                type="date"
                                value={editForm.end_date}
                                min={editForm.start_date}
                                onChange={(e) => setEditForm({ ...editForm, end_date: e.target.value })}
                                className="h-8 text-sm w-36"
                              />
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleSaveEdit}
                                className="h-8 w-8 text-green-600 hover:text-green-700"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleCancelEdit}
                                className="h-8 w-8 text-muted-foreground"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                              {event.title}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {event.description || "-"}
                          </TableCell>
                          <TableCell className="text-sm">{formatDateRange(event.start_date, event.end_date)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleStartEdit(event)}
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveEvent(event.id)}
                                className="h-8 w-8 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <DataTablePagination
              currentPage={currentPage}
              totalItems={events.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={setItemsPerPage}
            />
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Belum ada event kantor</p>
            <p className="text-sm">Tambahkan event untuk ditampilkan di kalender perusahaan</p>
          </div>
        )}

        {/* Export / Import */}
        <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/50 rounded-lg border border-border">
          <FileDown className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground">Ekspor / Impor:</span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            disabled={events.length === 0}
            onClick={() => {
              const exportData = events.map(({ id, ...rest }) => rest);
              const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `event-kantor-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <FileDown className="h-3 w-3 mr-1" />
            Ekspor JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            disabled={events.length === 0}
            onClick={() => {
              const data = events.map(ev => ({
                "Nama Event": ev.title,
                "Keterangan": ev.description || "",
                "Tanggal Mulai": ev.start_date,
                "Tanggal Selesai": ev.end_date,
              }));
              exportToExcelFile(data, "Event Kantor", `event-kantor-${new Date().toISOString().slice(0, 10)}.xlsx`);
            }}
          >
            <FileSpreadsheet className="h-3 w-3 mr-1" />
            Ekspor Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".json";
              input.onchange = async (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (!file || !user) return;
                const reader = new FileReader();
                reader.onload = async (ev) => {
                  try {
                    const imported = JSON.parse(ev.target?.result as string);
                    if (!Array.isArray(imported)) throw new Error("Format tidak valid");
                    const valid = imported.filter(
                      (item: any) => item.title && item.start_date && typeof item.title === "string"
                    );
                    if (valid.length === 0) throw new Error("Tidak ada data valid");

                    const inserts = valid.map((item: any) => ({
                      title: item.title,
                      description: item.description || null,
                      start_date: item.start_date,
                      end_date: item.end_date || item.start_date,
                      created_by: user.id,
                    }));

                    const { error } = await supabase.from("company_events").insert(inserts);
                    if (error) throw error;

                    toast({
                      title: "Berhasil",
                      description: `${inserts.length} event berhasil diimpor.`,
                    });
                    fetchEvents();
                  } catch (err: any) {
                    toast({ title: "Gagal Impor", description: err.message || "File JSON tidak valid", variant: "destructive" });
                  }
                };
                reader.readAsText(file);
              };
              input.click();
            }}
          >
            <Upload className="h-3 w-3 mr-1" />
            Impor JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".xlsx,.xls";
              input.onchange = async (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (!file || !user) return;
                try {
                  const buffer = await file.arrayBuffer();
                  const workbook = new ExcelJS.Workbook();
                  await workbook.xlsx.load(buffer);
                  const sheet = workbook.worksheets[0];
                  if (!sheet) throw new Error("File Excel kosong");

                  let titleCol = -1, descCol = -1, startCol = -1, endCol = -1;
                  sheet.getRow(1).eachCell((cell, colNumber) => {
                    const val = String(cell.value ?? "").toLowerCase().trim();
                    if (val.includes("nama") || val.includes("title") || val.includes("event")) titleCol = colNumber;
                    if (val.includes("keterangan") || val.includes("desc")) descCol = colNumber;
                    if (val.includes("mulai") || val.includes("start")) startCol = colNumber;
                    if (val.includes("selesai") || val.includes("end")) endCol = colNumber;
                  });

                  if (titleCol === -1) titleCol = 1;
                  if (startCol === -1) startCol = descCol === -1 ? 2 : 3;
                  if (endCol === -1) endCol = startCol + 1;

                  const parseDate = (val: any): string => {
                    if (val instanceof Date) return val.toISOString().slice(0, 10);
                    if (typeof val === "string") {
                      const d = new Date(val);
                      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
                    }
                    return "";
                  };

                  const inserts: any[] = [];
                  sheet.eachRow((row, rowNumber) => {
                    if (rowNumber === 1) return;
                    const title = String(row.getCell(titleCol).value ?? "").trim();
                    const desc = descCol > 0 ? String(row.getCell(descCol).value ?? "").trim() : "";
                    const startDate = parseDate(row.getCell(startCol).value);
                    const endDate = parseDate(row.getCell(endCol).value) || startDate;
                    if (title && startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
                      inserts.push({
                        title,
                        description: desc || null,
                        start_date: startDate,
                        end_date: endDate,
                        created_by: user.id,
                      });
                    }
                  });

                  if (inserts.length === 0) throw new Error("Tidak ada data valid ditemukan dalam file Excel");

                  const { error } = await supabase.from("company_events").insert(inserts);
                  if (error) throw error;

                  toast({
                    title: "Berhasil",
                    description: `${inserts.length} event berhasil diimpor dari Excel.`,
                  });
                  fetchEvents();
                } catch (err: any) {
                  toast({ title: "Gagal Impor Excel", description: err.message || "File Excel tidak valid", variant: "destructive" });
                }
              };
              input.click();
            }}
          >
            <Upload className="h-3 w-3 mr-1" />
            Impor Excel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
