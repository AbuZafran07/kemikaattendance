import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, CalendarDays, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
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
  const [newEvent, setNewEvent] = useState({ title: "", description: "", date: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("company_events")
      .select("id, title, description, event_date")
      .order("event_date", { ascending: true });

    if (!error && data) {
      setEvents(data);
    }
    setIsLoading(false);
  };

  const handleAddEvent = async () => {
    if (!newEvent.title.trim() || !newEvent.date || !user) return;
    setIsSaving(true);

    const { error } = await supabase.from("company_events").insert({
      title: newEvent.title.trim(),
      description: newEvent.description.trim() || null,
      event_date: newEvent.date,
      created_by: user.id,
    });

    if (error) {
      toast({ title: "Gagal menambahkan event", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Berhasil", description: "Event kantor berhasil ditambahkan" });
      
      // Send notification to all employees
      const { title, body } = NotificationTemplates.companyEventCreated(
        newEvent.title.trim(),
        formatDateForNotification(newEvent.date)
      );
      notifyAllEmployees(title, body, { type: 'company_event' });
      
      setNewEvent({ title: "", description: "", date: "" });
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
      return format(new Date(dateStr), "EEEE, dd MMMM yyyy", { locale: id });
    } catch {
      return dateStr;
    }
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
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 space-y-2">
            <Label htmlFor="event_title">Nama Event</Label>
            <Input
              id="event_title"
              placeholder="contoh: Meeting Bulanan, Gathering Kantor"
              value={newEvent.title}
              onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
            />
          </div>
          <div className="flex-1 space-y-2">
            <Label htmlFor="event_desc">Keterangan (opsional)</Label>
            <Input
              id="event_desc"
              placeholder="contoh: Ruang meeting lt.3"
              value={newEvent.description}
              onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
            />
          </div>
          <div className="w-full sm:w-48 space-y-2">
            <Label htmlFor="event_date">Tanggal</Label>
            <Input
              id="event_date"
              type="date"
              value={newEvent.date}
              onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={handleAddEvent}
              disabled={!newEvent.title.trim() || !newEvent.date || isSaving}
              className="bg-blue-600 hover:bg-blue-700"
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
                  {events.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map((event) => (
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
                      <TableCell>{formatDate(event.event_date)}</TableCell>
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
            {Math.ceil(events.length / ITEMS_PER_PAGE) > 1 && (
              <div className="flex items-center justify-between mt-3">
                <p className="text-sm text-muted-foreground">
                  Menampilkan {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, events.length)} dari {events.length} data
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">{currentPage} / {Math.ceil(events.length / ITEMS_PER_PAGE)}</span>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(Math.ceil(events.length / ITEMS_PER_PAGE), p + 1))} disabled={currentPage === Math.ceil(events.length / ITEMS_PER_PAGE)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
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
