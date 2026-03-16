import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, CalendarDays, Loader2 } from "lucide-react";
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
                    <TableHead className="w-16 text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((event) => (
                    <TableRow key={event.id}>
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
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveEvent(event.id)}
                          className="h-8 w-8 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
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
      </CardContent>
    </Card>
  );
}