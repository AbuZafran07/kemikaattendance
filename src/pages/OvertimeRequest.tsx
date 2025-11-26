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
    overtimeDate: '',
    startTime: '',
    endTime: '',
    reason: ''
  });

  // Calculate total hours automatically
  const calculateHours = () => {
    if (!formData.startTime || !formData.endTime) return 0;
    
    const [startHour, startMinute] = formData.startTime.split(':').map(Number);
    const [endHour, endMinute] = formData.endTime.split(':').map(Number);
    
    const startTotalMinutes = startHour * 60 + startMinute;
    const endTotalMinutes = endHour * 60 + endMinute;
    
    let diffMinutes = endTotalMinutes - startTotalMinutes;
    
    // Handle overnight overtime (e.g., 23:00 to 02:00)
    if (diffMinutes < 0) {
      diffMinutes += 24 * 60;
    }
    
    return Math.round((diffMinutes / 60) * 10) / 10; // Round to 1 decimal place
  };

  const totalHours = calculateHours();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.startTime || !formData.endTime) {
      toast({
        title: "Data Tidak Lengkap",
        description: "Silakan isi jam mulai dan jam selesai",
        variant: "destructive",
      });
      return;
    }
    
    if (totalHours <= 0) {
      toast({
        title: "Jam Tidak Valid",
        description: "Jam selesai harus lebih besar dari jam mulai",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('overtime_requests')
        .insert([{
          user_id: profile?.id!,
          overtime_date: formData.overtimeDate,
          hours: Math.ceil(totalHours), // Round up to nearest hour for storage
          reason: formData.reason,
          status: 'pending'
        }]);

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: "Pengajuan lembur berhasil dikirim",
      });

      navigate('/employee');
    } catch (error: any) {
      toast({
        title: "Gagal",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/10">
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/employee')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <img src={logo} alt="Kemika" className="h-10 object-contain" />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>Ajukan Lembur</CardTitle>
            <CardDescription>Isi formulir pengajuan lembur</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="overtimeDate">Tanggal Lembur</Label>
                <Input
                  id="overtimeDate"
                  type="date"
                  value={formData.overtimeDate}
                  onChange={(e) => setFormData({...formData, overtimeDate: e.target.value})}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startTime">Jam Mulai</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endTime">Jam Selesai</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({...formData, endTime: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Jumlah Jam</Label>
                <div className="flex items-center h-10 px-3 py-2 rounded-md border border-input bg-muted">
                  <span className="text-sm text-muted-foreground">
                    {totalHours > 0 ? `${totalHours} jam` : 'Isi jam mulai dan selesai'}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Alasan/Deskripsi Pekerjaan</Label>
                <Textarea
                  id="reason"
                  value={formData.reason}
                  onChange={(e) => setFormData({...formData, reason: e.target.value})}
                  placeholder="Jelaskan pekerjaan yang akan dilakukan saat lembur..."
                  rows={4}
                  required
                />
              </div>

              <Button 
                type="submit" 
                className="w-full"
                disabled={isSubmitting || totalHours <= 0}
              >
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
