import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";

const OvertimeRequest = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    overtimeDate: "",
    startTime: "",
    endTime: "",
    reason: "",
  });

  // 🔹 Hitung jam lembur otomatis
  const calculateHours = () => {
    if (!formData.startTime || !formData.endTime) return 0;

    const [startHour, startMinute] = formData.startTime.split(":").map(Number);
    const [endHour, endMinute] = formData.endTime.split(":").map(Number);

    const startTotalMinutes = startHour * 60 + startMinute;
    const endTotalMinutes = endHour * 60 + endMinute;

    let diffMinutes = endTotalMinutes - startTotalMinutes;

    // Handle lembur melewati tengah malam
    if (diffMinutes < 0) {
      diffMinutes += 24 * 60;
    }

    // Bulatkan 1 desimal
    return Math.round((diffMinutes / 60) * 10) / 10;
  };

  const totalHours = calculateHours();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 🔹 Validasi input dasar
    if (!formData.overtimeDate || !formData.startTime || !formData.endTime || !formData.reason) {
      toast({
        title: "Data belum lengkap",
        description: "Mohon isi semua kolom sebelum mengirim pengajuan lembur.",
        variant: "destructive",
      });
      return;
    }

    // 🔹 Validasi jam
    if (totalHours <= 0) {
      toast({
        title: "Jam tidak valid",
        description: "Jam selesai harus lebih besar dari jam mulai.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Simpan data lembur ke Supabase
      const { error } = await supabase.from("overtime_requests").insert([
        {
          user_id: profile?.id,
          overtime_date: formData.overtimeDate,
          start_time: formData.startTime,
          end_time: formData.endTime,
          hours: totalHours, // simpan jam aktual (boleh desimal)
          reason: formData.reason,
          status: "pending", // pastikan cocok dengan dashboard HRGA
          created_at: new Date().toISOString(),
        },
      ]);

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: "Pengajuan lembur berhasil dikirim dan menunggu persetujuan HRGA.",
      });

      navigate("/employee");
    } catch (error: any) {
      console.error("Error submitting overtime:", error);
      toast({
        title: "Gagal mengirim pengajuan",
        description: error.message || "Terjadi kesalahan saat mengirim data.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/10">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/employee")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <img src={logo} alt="Kemika" className="h-10 object-contain" />
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="container mx-auto px-4 py-6 max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>Ajukan Lembur</CardTitle>
            <CardDescription>Isi formulir pengajuan lembur</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Tanggal lembur */}
              <div className="space-y-2">
                <Label htmlFor="overtimeDate">Tanggal Lembur</Label>
                <Input
                  id="overtimeDate"
                  type="date"
                  value={formData.overtimeDate}
                  onChange={(e) => setFormData({ ...formData, overtimeDate: e.target.value })}
                  required
                />
              </div>

              {/* Jam mulai & selesai */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startTime">Jam Mulai</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endTime">Jam Selesai</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Total jam */}
              <div className="space-y-2">
                <Label>Jumlah Jam</Label>
                <div className="flex items-center h-10 px-3 py-2 rounded-md border border-input bg-muted">
                  <span className="text-sm text-muted-foreground">
                    {totalHours > 0 ? `${totalHours} jam` : "Isi jam mulai dan selesai"}
                  </span>
                </div>
              </div>

              {/* Alasan / Deskripsi */}
              <div className="space-y-2">
                <Label htmlFor="reason">Alasan / Deskripsi Pekerjaan</Label>
                <Textarea
                  id="reason"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="Jelaskan pekerjaan yang akan dilakukan saat lembur..."
                  rows={4}
                  required
                />
              </div>

              {/* Tombol submit */}
              <Button type="submit" className="w-full" disabled={isSubmitting || totalHours <= 0}>
                {isSubmitting ? "Mengirim..." : "Kirim Pengajuan"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OvertimeRequest;
