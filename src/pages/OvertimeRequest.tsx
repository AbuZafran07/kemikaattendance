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
    hours: '',
    reason: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('overtime_requests')
        .insert([{
          user_id: profile?.id!,
          overtime_date: formData.overtimeDate,
          hours: parseInt(formData.hours),
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

              <div className="space-y-2">
                <Label htmlFor="hours">Jumlah Jam</Label>
                <Input
                  id="hours"
                  type="number"
                  min="1"
                  max="12"
                  value={formData.hours}
                  onChange={(e) => setFormData({...formData, hours: e.target.value})}
                  placeholder="Contoh: 3"
                  required
                />
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
                disabled={isSubmitting}
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
