import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Building2, Clock, Calendar, FileText, Bell } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function Settings() {
  const { toast } = useToast();

  // State contoh sementara
  const [officeLocation, setOfficeLocation] = useState("Kantor Pusat Jakarta");
  const [checkInStart, setCheckInStart] = useState("08:00");
  const [checkInEnd, setCheckInEnd] = useState("09:00");
  const [lateTolerance, setLateTolerance] = useState(15);
  const [annualLeave, setAnnualLeave] = useState(12);
  const [maxOvertime, setMaxOvertime] = useState(4);

  const handleSave = (section: string) => {
    toast({
      title: "Pengaturan Disimpan",
      description: `Perubahan pada ${section} berhasil disimpan.`,
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fadeIn">
        {/* HEADER */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pengaturan Sistem</h1>
          <p className="text-muted-foreground mt-1">
            Kelola konfigurasi sistem, kebijakan jam kerja, cuti, lembur, dan notifikasi
          </p>
        </div>

        {/* 📍 LOKASI KANTOR */}
        <Card className="border-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Lokasi Kantor
            </CardTitle>
            <CardDescription>Atur nama dan lokasi utama kantor</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label htmlFor="office">Nama Kantor</Label>
            <Input id="office" value={officeLocation} onChange={(e) => setOfficeLocation(e.target.value)} />
            <Button onClick={() => handleSave("Lokasi Kantor")}>Simpan</Button>
          </CardContent>
        </Card>

        {/* 🕐 JAM KERJA */}
        <Card className="border-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Jam Kerja
            </CardTitle>
            <CardDescription>Atur jam kerja, jam masuk, dan toleransi keterlambatan</CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-4">
            <div>
              <Label>Jam Masuk</Label>
              <Input type="time" value={checkInStart} onChange={(e) => setCheckInStart(e.target.value)} />
            </div>
            <div>
              <Label>Batas Akhir Masuk</Label>
              <Input type="time" value={checkInEnd} onChange={(e) => setCheckInEnd(e.target.value)} />
            </div>
            <div>
              <Label>Toleransi (menit)</Label>
              <Input
                type="number"
                min={0}
                value={lateTolerance}
                onChange={(e) => setLateTolerance(Number(e.target.value))}
              />
            </div>
            <div className="md:col-span-3">
              <Button onClick={() => handleSave("Jam Kerja")}>Simpan</Button>
            </div>
          </CardContent>
        </Card>

        {/* 🗓️ KEBIJAKAN CUTI */}
        <Card className="border-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Kebijakan Cuti
            </CardTitle>
            <CardDescription>Atur kuota cuti tahunan karyawan</CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Kuota Cuti Tahunan</Label>
              <Input
                type="number"
                min={0}
                value={annualLeave}
                onChange={(e) => setAnnualLeave(Number(e.target.value))}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={() => handleSave("Kebijakan Cuti")}>Simpan</Button>
            </div>
          </CardContent>
        </Card>

        {/* ⏱️ KEBIJAKAN LEMBUR */}
        <Card className="border-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Kebijakan Lembur
            </CardTitle>
            <CardDescription>Atur batas maksimum jam lembur per hari</CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Maksimal Jam Lembur per Hari</Label>
              <Input
                type="number"
                min={1}
                value={maxOvertime}
                onChange={(e) => setMaxOvertime(Number(e.target.value))}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={() => handleSave("Kebijakan Lembur")}>Simpan</Button>
            </div>
          </CardContent>
        </Card>

        {/* 🔔 PENGATURAN NOTIFIKASI */}
        <Card className="border-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Pengaturan Notifikasi
            </CardTitle>
            <CardDescription>Atur preferensi notifikasi sistem</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Fitur notifikasi real-time akan tersedia di versi mendatang.
            </p>
            <Button onClick={() => handleSave("Notifikasi")}>Simpan</Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
