import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, AlertCircle, Info } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { overtimeRequestSchema, OvertimeRequestFormData } from "@/lib/validationSchemas";
import { useOvertimePolicy, isHoliday, isWeekend } from "@/hooks/usePolicySettings";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import logo from "@/assets/logo.png";
import { EmployeeBottomNav } from "@/components/EmployeeBottomNav";

const OvertimeRequest = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();
  const { policy, isLoading: isPolicyLoading } = useOvertimePolicy();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingHours, setExistingHours] = useState({ week: 0, month: 0 });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

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
  const overtimeDate = form.watch("overtimeDate");

  // Fetch existing overtime hours for validation
  useEffect(() => {
    const fetchExistingHours = async () => {
      if (!profile?.id || !overtimeDate) return;

      const selectedDate = new Date(overtimeDate);
      const weekStart = format(startOfWeek(selectedDate, { weekStartsOn: 1 }), "yyyy-MM-dd");
      const weekEnd = format(endOfWeek(selectedDate, { weekStartsOn: 1 }), "yyyy-MM-dd");
      const monthStart = format(startOfMonth(selectedDate), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(selectedDate), "yyyy-MM-dd");

      try {
        // Get weekly hours
        const { data: weekData } = await supabase
          .from("overtime_requests")
          .select("hours")
          .eq("user_id", profile.id)
          .in("status", ["pending", "approved"])
          .gte("overtime_date", weekStart)
          .lte("overtime_date", weekEnd);

        // Get monthly hours
        const { data: monthData } = await supabase
          .from("overtime_requests")
          .select("hours")
          .eq("user_id", profile.id)
          .in("status", ["pending", "approved"])
          .gte("overtime_date", monthStart)
          .lte("overtime_date", monthEnd);

        setExistingHours({
          week: weekData?.reduce((sum, r) => sum + r.hours, 0) || 0,
          month: monthData?.reduce((sum, r) => sum + r.hours, 0) || 0,
        });
      } catch (error) {
        console.error("Error fetching existing hours:", error);
      }
    };

    fetchExistingHours();
  }, [profile?.id, overtimeDate]);

  const totalHours = useMemo(() => {
    if (!startTime || !endTime) return 0;

    const [startHour, startMinute] = startTime.split(":").map(Number);
    const [endHour, endMinute] = endTime.split(":").map(Number);

    const startTotalMinutes = startHour * 60 + startMinute;
    const endTotalMinutes = endHour * 60 + endMinute;

    let diffMinutes = endTotalMinutes - startTotalMinutes;

    if (diffMinutes < 0) {
      diffMinutes += 24 * 60;
    }

    return Math.round((diffMinutes / 60) * 10) / 10;
  }, [startTime, endTime]);

  // Validate based on policy settings
  useEffect(() => {
    const errors: string[] = [];

    if (!overtimeDate || totalHours <= 0) {
      setValidationErrors([]);
      return;
    }

    // Check minimum hours
    if (totalHours < policy.min_hours) {
      errors.push(`Minimal lembur adalah ${policy.min_hours} jam`);
    }

    // Check maximum hours per day
    if (totalHours > policy.max_hours_per_day) {
      errors.push(`Maksimal lembur per hari adalah ${policy.max_hours_per_day} jam`);
    }

    // Check weekly limit
    if (existingHours.week + totalHours > policy.max_hours_per_week) {
      errors.push(
        `Melebihi batas lembur mingguan (${policy.max_hours_per_week} jam). Sisa kuota: ${Math.max(0, policy.max_hours_per_week - existingHours.week)} jam`
      );
    }

    // Check monthly limit
    if (existingHours.month + totalHours > policy.max_hours_per_month) {
      errors.push(
        `Melebihi batas lembur bulanan (${policy.max_hours_per_month} jam). Sisa kuota: ${Math.max(0, policy.max_hours_per_month - existingHours.month)} jam`
      );
    }

    // Check advance request days
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(overtimeDate);
    const daysDiff = Math.floor((selectedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff < policy.min_days_advance_request) {
      errors.push(`Pengajuan lembur harus minimal ${policy.min_days_advance_request} hari sebelumnya`);
    }

    // Check weekend restriction
    if (isWeekend(overtimeDate) && !policy.allow_weekend_overtime) {
      errors.push("Lembur di hari weekend tidak diperbolehkan");
    }

    // Check holiday restriction
    if (isHoliday(overtimeDate, policy.holidays) && !policy.allow_holiday_overtime) {
      errors.push("Lembur di hari libur nasional tidak diperbolehkan");
    }

    setValidationErrors(errors);
  }, [overtimeDate, totalHours, policy, existingHours]);

  const onSubmit = async (data: OvertimeRequestFormData) => {
    if (totalHours <= 0) {
      toast({
        title: "Jam tidak valid",
        description: "Jam selesai harus lebih besar dari jam mulai.",
        variant: "destructive",
      });
      return;
    }

    if (validationErrors.length > 0) {
      toast({
        title: "Validasi Gagal",
        description: validationErrors[0],
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

  const getDateTypeLabel = () => {
    if (!overtimeDate) return null;
    
    if (isHoliday(overtimeDate, policy.holidays)) {
      const holiday = policy.holidays.find(h => h.date === overtimeDate);
      return (
        <span className="text-orange-600 dark:text-orange-400">
          Hari Libur: {holiday?.name} (Multiplier: {policy.holiday_rate_multiplier}x)
        </span>
      );
    }
    
    if (isWeekend(overtimeDate)) {
      return (
        <span className="text-blue-600 dark:text-blue-400">
          Weekend (Multiplier: {policy.weekend_rate_multiplier}x)
        </span>
      );
    }
    
    return (
      <span className="text-muted-foreground">
        Hari Kerja (Multiplier: {policy.weekday_rate_multiplier}x)
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/10 pb-24">
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
            {isPolicyLoading ? (
              <p className="text-muted-foreground">Memuat kebijakan...</p>
            ) : (
              <>
                {/* Policy Info */}
                <Alert className="mb-4">
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Batas lembur: Maks. {policy.max_hours_per_day} jam/hari, {policy.max_hours_per_week} jam/minggu, {policy.max_hours_per_month} jam/bulan
                  </AlertDescription>
                </Alert>

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
                          {overtimeDate && (
                            <p className="text-xs">{getDateTypeLabel()}</p>
                          )}
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

                    {/* Validation Errors */}
                    {validationErrors.length > 0 && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <ul className="list-disc list-inside text-xs space-y-1">
                            {validationErrors.map((error, idx) => (
                              <li key={idx}>{error}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}

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

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isSubmitting || totalHours <= 0 || validationErrors.length > 0}
                    >
                      {isSubmitting ? "Mengirim..." : "Kirim Pengajuan"}
                    </Button>
                  </form>
                </Form>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <EmployeeBottomNav />
    </div>
  );
};

export default OvertimeRequest;
