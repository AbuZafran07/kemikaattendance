import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Calendar, Copy, Download, Loader2, Pencil, Check, X } from "lucide-react";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface Holiday {
  id: string;
  name: string;
  date: string;
}

interface HolidayManagerProps {
  holidays: Holiday[];
  onHolidaysChange: (holidays: Holiday[]) => void;
}

export function HolidayManager({ holidays, onHolidaysChange }: HolidayManagerProps) {
  const { toast } = useToast();
  const [newHoliday, setNewHoliday] = useState({ name: "", date: "" });
  const [isFetching, setIsFetching] = useState(false);
  const [fetchYear, setFetchYear] = useState(String(new Date().getFullYear()));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", date: "" });

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    holidays.forEach(h => {
      const y = parseInt(h.date.substring(0, 4));
      if (!isNaN(y)) years.add(y);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [holidays]);

  const currentYear = new Date().getFullYear();

  const handleCopyFromYear = (sourceYear: number) => {
    const targetYear = sourceYear + 1;
    const sourceHolidays = holidays.filter(h => h.date.startsWith(`${sourceYear}-`));
    if (sourceHolidays.length === 0) return;

    const existingTargetDates = new Set(
      holidays.filter(h => h.date.startsWith(`${targetYear}-`)).map(h => h.date)
    );

    let added = 0;
    const newHolidays = [...holidays];
    sourceHolidays.forEach(h => {
      const newDate = `${targetYear}${h.date.substring(4)}`;
      if (!existingTargetDates.has(newDate)) {
        newHolidays.push({
          id: crypto.randomUUID(),
          name: h.name,
          date: newDate,
        });
        added++;
      }
    });

    if (added > 0) {
      onHolidaysChange(newHolidays.sort((a, b) => a.date.localeCompare(b.date)));
      toast({
        title: "Berhasil",
        description: `${added} hari libur dari ${sourceYear} berhasil disalin ke ${targetYear}. Jangan lupa simpan perubahan.`,
      });
    } else {
      toast({
        title: "Tidak ada yang disalin",
        description: `Semua hari libur ${sourceYear} sudah ada di ${targetYear}.`,
        variant: "destructive",
      });
    }
  };

  const handleAutoFetch = async () => {
    setIsFetching(true);
    try {
      const year = parseInt(fetchYear);
      const { data, error } = await supabase.functions.invoke("fetch-indonesia-holidays", {
        body: { year },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "Gagal mengambil data");
      }

      const fetched: Holiday[] = data.holidays;
      const existingDates = new Set(holidays.map(h => h.date));
      let added = 0;
      const merged = [...holidays];

      fetched.forEach(h => {
        if (!existingDates.has(h.date)) {
          merged.push(h);
          added++;
        }
      });

      if (added > 0) {
        onHolidaysChange(merged.sort((a, b) => a.date.localeCompare(b.date)));
        toast({
          title: "Berhasil",
          description: `${added} hari libur nasional ${year} berhasil ditambahkan. Jangan lupa simpan perubahan.`,
        });
      } else {
        toast({
          title: "Tidak ada yang ditambahkan",
          description: `Semua hari libur nasional ${year} sudah ada dalam daftar.`,
        });
      }
    } catch (err: any) {
      console.error("Error fetching holidays:", err);
      toast({
        title: "Gagal mengambil data",
        description: err.message || "Terjadi kesalahan saat mengambil data hari libur",
        variant: "destructive",
      });
    } finally {
      setIsFetching(false);
    }
  };

  const handleAddHoliday = () => {
    if (!newHoliday.name.trim() || !newHoliday.date) return;

    const holiday: Holiday = {
      id: crypto.randomUUID(),
      name: newHoliday.name.trim(),
      date: newHoliday.date,
    };

    onHolidaysChange([...holidays, holiday].sort((a, b) => a.date.localeCompare(b.date)));
    setNewHoliday({ name: "", date: "" });
  };

  const handleRemoveHoliday = (id: string) => {
    onHolidaysChange(holidays.filter((h) => h.id !== id));
  };

  const handleStartEdit = (holiday: Holiday) => {
    setEditingId(holiday.id);
    setEditForm({ name: holiday.name, date: holiday.date });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({ name: "", date: "" });
  };

  const handleSaveEdit = () => {
    if (!editingId || !editForm.name.trim() || !editForm.date) return;
    const updated = holidays.map(h =>
      h.id === editingId ? { ...h, name: editForm.name.trim(), date: editForm.date } : h
    );
    onHolidaysChange(updated.sort((a, b) => a.date.localeCompare(b.date)));
    setEditingId(null);
    setEditForm({ name: "", date: "" });
    toast({ title: "Berhasil", description: "Data hari libur diperbarui. Jangan lupa simpan perubahan." });
  };

  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const paginatedHolidays = holidays.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

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
          <Calendar className="h-5 w-5" />
          Daftar Hari Libur Nasional
        </CardTitle>
        <CardDescription>
          Kelola daftar hari libur nasional untuk perhitungan lembur dan validasi pengajuan
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Auto-fetch from API */}
        <div className="flex flex-wrap items-center gap-2 p-3 bg-primary/5 rounded-lg border border-border">
          <Download className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground">Auto-fetch hari libur nasional:</span>
          <Select value={fetchYear} onValueChange={setFetchYear}>
            <SelectTrigger className="w-24 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 5 }, (_, i) => currentYear - 1 + i).map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="default"
            size="sm"
            onClick={handleAutoFetch}
            disabled={isFetching}
            className="h-8 text-xs"
          >
            {isFetching ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Mengambil...
              </>
            ) : (
              <>
                <Download className="h-3 w-3 mr-1" />
                Ambil dari API
              </>
            )}
          </Button>
        </div>

        {/* Copy from previous year */}
        {availableYears.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 p-3 bg-accent/50 rounded-lg border border-border">
            <Copy className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm text-muted-foreground">Copy ke tahun berikutnya:</span>
            {availableYears.map(year => (
              <Button
                key={year}
                variant="outline"
                size="sm"
                onClick={() => handleCopyFromYear(year)}
                className="h-7 text-xs"
              >
                {year} → {year + 1}
              </Button>
            ))}
          </div>
        )}
        {/* Add New Holiday */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 space-y-2">
            <Label htmlFor="holiday_name">Nama Hari Libur</Label>
            <Input
              id="holiday_name"
              placeholder="contoh: Hari Kemerdekaan RI"
              value={newHoliday.name}
              onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
            />
          </div>
          <div className="w-full sm:w-48 space-y-2">
            <Label htmlFor="holiday_date">Tanggal</Label>
            <Input
              id="holiday_date"
              type="date"
              value={newHoliday.date}
              onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={handleAddHoliday}
              disabled={!newHoliday.name.trim() || !newHoliday.date}
            >
              <Plus className="h-4 w-4 mr-2" />
              Tambah
            </Button>
          </div>
        </div>

        {/* Holiday List */}
        {holidays.length > 0 ? (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Hari Libur</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead className="w-24 text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedHolidays.map((holiday) => (
                    <TableRow key={holiday.id}>
                      {editingId === holiday.id ? (
                        <>
                          <TableCell>
                            <Input
                              value={editForm.name}
                              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                              className="h-8 text-sm"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="date"
                              value={editForm.date}
                              onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                              className="h-8 text-sm w-40"
                            />
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
                          <TableCell className="font-medium">{holiday.name}</TableCell>
                          <TableCell>{formatDate(holiday.date)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleStartEdit(holiday)}
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveHoliday(holiday.id)}
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
              totalItems={holidays.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={setItemsPerPage}
            />
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Belum ada hari libur nasional yang ditambahkan</p>
            <p className="text-sm">Tambahkan hari libur untuk mengaktifkan validasi lembur di hari libur</p>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Daftar hari libur ini digunakan untuk menentukan tarif lembur (multiplier hari libur) dan validasi pengajuan lembur di hari libur.
        </p>
      </CardContent>
    </Card>
  );
}
