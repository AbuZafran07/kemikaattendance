import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { overtimeRequestSchema, OvertimeRequestFormData } from "@/lib/validationSchemas";
import logo from "@/assets/logo.png";

const OvertimeRequest = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<OvertimeRequestFormData>({
    resolver: zodResolver(overtimeRequestSchema),
    defaultValues: {
      overtimeDate: "",
      startTime: "",
      endTime: "",
      reason: "",
    },
  });

  const startTime = form.watch("startTime");
  const endTime = form.watch("endTime");

  const totalHours = useMemo(() => {
    if (!startTime || !endTime) return 0;

    const [startHour, startMinute] = startTime.split(":").map(Number);
    const [endHour, endMinute] = endTime.split(":").map(Number);

    const startTotalMinutes = startHour * 60 + startMinute;
    const endTotalMinutes = endHour * 60 + endMinute;

    let diffMinutes = endTotalMinutes - startTotalMinutes;

    // Handle lembur melewati tengah malam
    if (diffMinutes < 0) {
      diffMinutes += 24 * 60;
    }

    // Bulatkan 1 desimal
    return Math.round((diffMinutes / 60) * 10) / 10;
  }, [startTime, endTime]);

  const onSubmit = async (data: OvertimeRequestFormData) => {
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
      const { error } = await supabase.from("overtime_requests").insert([
        {
          user_id: profile?.id,
          overtime_date: data.overtimeDate,
          start_time: data.startTime,
          end_time: data.endTime,
          hours: totalHours,
          reason: data.reason,
          status: "pending",
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

      <div className="container mx-auto px-4 py-6 max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>Ajukan Lembur</CardTitle>
            <CardDescription>Isi formulir pengajuan lembur</CardDescription>
          </CardHeader>

          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="overtimeDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tanggal Lembur</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Jam Mulai</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="endTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Jam Selesai</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Jumlah Jam</Label>
                  <div className="flex items-center h-10 px-3 py-2 rounded-md border border-input bg-muted">
                    <span className="text-sm text-muted-foreground">
                      {totalHours > 0 ? `${totalHours} jam` : "Isi jam mulai dan selesai"}
                    </span>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Alasan / Deskripsi Pekerjaan</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Jelaskan pekerjaan yang akan dilakukan saat lembur..."
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={isSubmitting || totalHours <= 0}>
                  {isSubmitting ? "Mengirim..." : "Kirim Pengajuan"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OvertimeRequest;
