import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Calendar } from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";

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
  const [newHoliday, setNewHoliday] = useState({ name: "", date: "" });

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
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Hari Libur</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead className="w-16 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holidays.map((holiday) => (
                  <TableRow key={holiday.id}>
                    <TableCell className="font-medium">{holiday.name}</TableCell>
                    <TableCell>{formatDate(holiday.date)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveHoliday(holiday.id)}
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
