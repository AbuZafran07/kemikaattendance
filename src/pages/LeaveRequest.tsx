import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";

const LeaveRequest = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    leaveType: "",
    startDate: "",
    endDate: "",
    reason: "",
  });

  // Hitung total hari cuti
  const calculateDays = (start: string, end: string) => {
    if (!start || !end) return 0;
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validasi form
      if (!formData.leaveType || !formData.startDate || !formData.endDate || !formData.reason) {
        toast({
          title: "Data belum lengkap",
          description: "Mohon isi semua field sebelum mengirim.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Validasi tanggal
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      if (end < start) {
        toast({
          title: "Tanggal tidak valid",
          description: "Tanggal selesai tidak boleh lebih awal dari tanggal mulai.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      const totalDays = calculateDays(formData.startDate, formData.endDate);

      // Validasi sisa cuti tahunan (opsional)
      if (formData.leaveType === "cuti_tahunan" && profile?.remaining_leave) {
        if (totalDays > profile.remaining_leave) {
          toast({
            title: "Cuti melebihi jatah",
            description: `Sisa cuti tahunan Anda hanya ${profile.remaining_leave} hari.`,
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }
      }

      // Simpan ke Supabase
      const { error } = await supabase.from("leave_requests").insert([
        {
          user_id: profile?.id,
          leave_type: formData.leaveType,
          start_date: formData.startDate,
          end_date: formData.endDate,
          total_days: totalDays,
          reason: formData.reason,
          status: "pending", // pastikan cocok dengan filter di dashboard
          created_at: new Date().toISOString(), // pastikan waktu tersimpan
        },
      ]);

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: "Pengajuan cuti berhasil dikirim dan menunggu persetujuan HRGA.",
      });

      navigate("/employee");
    } catch (error: any) {
      console.error("Error submitting leave:", error);
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
            <CardTitle>Ajukan Cuti</CardTitle>
            <CardDescription>Isi formulir pengajuan cuti</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Jenis Cuti */}
              <div className="space-y-2">
                <Label htmlFor="leaveType">Jenis Cuti</Label>
                <Select
                  value={formData.leaveType}
                  onValueChange={(value) => setFormData({ ...formData, leaveType: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih jenis cuti" />
                  </SelectTrigger>
                  <SelectContent className="z-[9999] bg-popover">
                    <SelectItem value="cuti_tahunan">Cuti Tahunan</SelectItem>
                    <SelectItem value="izin">Izin</SelectItem>
                    <SelectItem value="sakit">Sakit</SelectItem>
                    <SelectItem value="lupa_absen">Lupa Absen</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Tanggal Mulai */}
              <div className="space-y-2">
                <Label htmlFor="startDate">Tanggal Mulai</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  required
                />
              </div>

              {/* Tanggal Selesai */}
              <div className="space-y-2">
                <Label htmlFor="endDate">Tanggal Selesai</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  min={formData.startDate}
                  required
                />
              </div>

              {/* Info Durasi & Sisa Cuti */}
              {formData.startDate && formData.endDate && (
                <div className="bg-primary/10 p-3 rounded-lg">
                  <p className="text-sm">
                    Total hari:{" "}
                    <span className="font-bold">{calculateDays(formData.startDate, formData.endDate)} hari</span>
                  </p>
                  {profile?.remaining_leave && (
                    <p className="text-sm text-muted-foreground">Sisa cuti tahunan: {profile.remaining_leave} hari</p>
                  )}
                </div>
              )}

              {/* Alasan */}
              <div className="space-y-2">
                <Label htmlFor="reason">Alasan</Label>
                <Textarea
                  id="reason"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="Jelaskan alasan pengajuan cuti..."
                  rows={4}
                  required
                />
              </div>

              {/* Tombol Kirim */}
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Mengirim..." : "Kirim Pengajuan"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LeaveRequest;
