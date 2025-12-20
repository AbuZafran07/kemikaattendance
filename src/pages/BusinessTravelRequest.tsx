import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";
import { EmployeeBottomNav } from "@/components/EmployeeBottomNav";
import { notifyAdmins, NotificationTemplates } from "@/lib/notifications";

const businessTravelSchema = z.object({
  destination: z.string().trim().min(1, "Tujuan harus diisi").max(200, "Tujuan maksimal 200 karakter"),
  purpose: z.string().trim().min(1, "Keperluan harus diisi").max(500, "Keperluan maksimal 500 karakter"),
  startDate: z.string().min(1, "Tanggal mulai harus diisi"),
  endDate: z.string().min(1, "Tanggal selesai harus diisi"),
  notes: z.string().trim().max(1000, "Catatan maksimal 1000 karakter").optional().or(z.literal("")),
}).refine(data => new Date(data.endDate) >= new Date(data.startDate), {
  message: "Tanggal selesai harus setelah tanggal mulai",
  path: ["endDate"],
});

type BusinessTravelFormData = z.infer<typeof businessTravelSchema>;

const BusinessTravelRequest = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<BusinessTravelFormData>({
    resolver: zodResolver(businessTravelSchema),
    defaultValues: {
      destination: "",
      purpose: "",
      startDate: "",
      endDate: "",
      notes: "",
    },
  });

  const startDate = form.watch("startDate");
  const endDate = form.watch("endDate");

  const calculateDays = (start: string, end: string) => {
    if (!start || !end) return 0;
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const totalDays = useMemo(() => {
    return calculateDays(startDate, endDate);
  }, [startDate, endDate]);

  const onSubmit = async (data: BusinessTravelFormData) => {
    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("business_travel_requests").insert([
        {
          user_id: profile?.id,
          destination: data.destination,
          purpose: data.purpose,
          start_date: data.startDate,
          end_date: data.endDate,
          total_days: totalDays,
          notes: data.notes || null,
        },
      ]);

      if (error) throw error;

      // Send notification to admins
      const notification = NotificationTemplates.businessTravelSubmitted(
        profile?.full_name || 'Karyawan',
        data.destination,
        totalDays
      );
      notifyAdmins(notification.title, notification.body, { type: 'business_travel' });

      toast({
        title: "Berhasil",
        description: "Pengajuan perjalanan dinas berhasil dikirim dan menunggu persetujuan.",
      });

      navigate("/employee");
    } catch (error: any) {
      toast({
        title: "Gagal Mengirim",
        description: error.message || "Terjadi kesalahan.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/10 pb-24">
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/employee")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <img src={logo} alt="Kemika" className="h-10 object-contain" />
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>Ajukan Perjalanan Dinas</CardTitle>
            <CardDescription>Isi formulir pengajuan perjalanan dinas luar</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="destination"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tujuan</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Contoh: Surabaya, Jakarta, dll" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="purpose"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Keperluan</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={3}
                          placeholder="Jelaskan keperluan perjalanan dinas..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tanggal Mulai</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tanggal Selesai</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      {totalDays > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Total: {totalDays} hari
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Catatan Tambahan (Opsional)</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={3}
                          placeholder="Catatan tambahan jika ada..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Mengirim..." : "Kirim Pengajuan"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      <EmployeeBottomNav />
    </div>
  );
};

export default BusinessTravelRequest;
