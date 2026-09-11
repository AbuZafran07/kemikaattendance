import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, AlertCircle, Info, Paperclip } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { leaveRequestSchema, LeaveRequestFormData } from "@/lib/validationSchemas";
import { useLeavePolicy } from "@/hooks/usePolicySettings";
import { getSpecialLeaveEndDate } from "@/lib/specialLeaveDates";
import logo from "@/assets/logo.png";
import { EmployeeBottomNav } from "@/components/EmployeeBottomNav";
import { notifyAdmins, NotificationTemplates, formatLeaveTypeForNotification } from "@/lib/notifications";

interface Holiday {
  id: string;
  name: string;
  date: string;
}

interface DepartmentColleague {
  id: string;
  full_name: string;
  jabatan: string;
}

interface SpecialLeaveType {
  id: string;
  code: string;
  name: string;
  default_duration_days: number;
  requires_document: boolean;
}

const LeaveRequest = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();
  const { policy, isLoading: isPolicyLoading } = useLeavePolicy();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [usedQuotas, setUsedQuotas] = useState({ annual: 0, sick: 0, permission: 0 });
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [colleagues, setColleagues] = useState<DepartmentColleague[]>([]);
  const [specialLeaveTypes, setSpecialLeaveTypes] = useState<SpecialLeaveType[]>([]);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  const isAnnualLeaveInactive = profile?.annual_leave_quota === 0 && profile?.remaining_leave === 0;

  const form = useForm<LeaveRequestFormData>({
    resolver: zodResolver(leaveRequestSchema),
    defaultValues: {
      leaveType: undefined,
      specialLeaveTypeId: undefined,
      startDate: "",
      endDate: "",
      reason: "",
      delegatedTo: "",
      delegationNotes: "",
    },
  });

  const leaveType = form.watch("leaveType");
  const specialLeaveTypeId = form.watch("specialLeaveTypeId");
  const startDate = form.watch("startDate");
  const endDate = form.watch("endDate");
  const selectedSpecialType = specialLeaveTypes.find((t) => t.id === specialLeaveTypeId);

  // Fetch used quotas for validation
  useEffect(() => {
    const fetchUsedQuotas = async () => {
      if (!profile?.id) return;

      const currentYear = new Date().getFullYear();
      const yearStart = `${currentYear}-01-01`;
      const yearEnd = `${currentYear}-12-31`;

      try {
        const { data } = await supabase
          .from("leave_requests")
          .select("leave_type, total_days")
          .eq("user_id", profile.id)
          .in("status", ["pending", "approved"])
          .gte("start_date", yearStart)
          .lte("start_date", yearEnd);

        const quotas = { annual: 0, sick: 0, permission: 0 };
        data?.forEach((req) => {
          if (req.leave_type === "cuti_tahunan") quotas.annual += req.total_days;
          else if (req.leave_type === "sakit") quotas.sick += req.total_days;
          else if (req.leave_type === "izin") quotas.permission += req.total_days;
        });

        setUsedQuotas(quotas);
      } catch (error) {
        console.error("Error fetching used quotas:", error);
      }
    };

    fetchUsedQuotas();
  }, [profile?.id]);

  // Fetch national holidays from overtime_policy settings
  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        const { data } = await supabase
          .from("system_settings")
          .select("value")
          .eq("key", "overtime_policy")
          .single();

        if (data?.value && typeof data.value === 'object' && 'holidays' in data.value) {
          const policyValue = data.value as { holidays?: Holiday[] };
          setHolidays(policyValue.holidays || []);
        }
      } catch (error) {
        console.error("Error fetching holidays:", error);
      }
    };

    fetchHolidays();
  }, []);

  // Fetch colleagues from same department (for task delegation)
  useEffect(() => {
    const fetchColleagues = async () => {
      if (!profile?.id) return;
      try {
        // RPC agar karyawan biasa tetap bisa melihat rekan satu departemen (RLS-safe)
        const { data, error } = await supabase.rpc("get_delegation_colleagues");
        if (error) throw error;
        setColleagues((data as DepartmentColleague[]) || []);
      } catch (error) {
        console.error("Error fetching colleagues:", error);
        setColleagues([]);
      }
    };
    fetchColleagues();
  }, [profile?.id]);

  // Fetch active special leave types (izin khusus)
  useEffect(() => {
    const fetchSpecialLeaveTypes = async () => {
      try {
        const { data } = await supabase
          .from("special_leave_types")
          .select("id, code, name, default_duration_days, requires_document")
          .eq("is_active", true)
          .order("display_order");
        if (data) setSpecialLeaveTypes(data);
      } catch (error) {
        console.error("Error fetching special leave types:", error);
      }
    };
    fetchSpecialLeaveTypes();
  }, []);

  // Izin khusus: jatah tetap per jenis dihitung HARI KERJA (weekend & hari libur dilewati)
  useEffect(() => {
    if (leaveType !== "izin_khusus" || !selectedSpecialType || !startDate) return;
    const computedEndDate = getSpecialLeaveEndDate(
      startDate,
      selectedSpecialType.default_duration_days,
      holidays
    );
    if (computedEndDate && form.getValues("endDate") !== computedEndDate) {
      form.setValue("endDate", computedEndDate, { shouldValidate: true });
    }
  }, [leaveType, selectedSpecialType, startDate, holidays, form]);

  // Reset pilihan izin khusus & lampiran saat pindah ke jenis cuti lain
  useEffect(() => {
    if (leaveType !== "izin_khusus") {
      form.setValue("specialLeaveTypeId", undefined);
      setAttachmentFile(null);
    }
  }, [leaveType, form]);

  // Calculate working days only (exclude Saturday, Sunday, and national holidays)
  const calculateWorkingDays = (start: string, end: string, holidayList: Holiday[]) => {
    if (!start || !end) return 0;
    const startDateObj = new Date(start);
    const endDateObj = new Date(end);
    
    if (endDateObj < startDateObj) return 0;
    
    // Create a Set of holiday dates for quick lookup (format: YYYY-MM-DD)
    const holidayDates = new Set(holidayList.map(h => h.date));
    
    let workingDays = 0;
    const currentDate = new Date(startDateObj);
    
    while (currentDate <= endDateObj) {
      const dayOfWeek = currentDate.getDay();
      const dateStr = currentDate.toISOString().split('T')[0]; // Format: YYYY-MM-DD
      
      // Skip if Saturday (6), Sunday (0), or a national holiday
      if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidayDates.has(dateStr)) {
        workingDays++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return workingDays;
  };

  const totalDays = useMemo(() => {
    // Izin khusus: jatah tetap per-kejadian (kalender), bukan hitungan hari kerja
    if (leaveType === "izin_khusus" && selectedSpecialType) {
      return selectedSpecialType.default_duration_days;
    }
    return calculateWorkingDays(startDate, endDate, holidays);
  }, [leaveType, selectedSpecialType, startDate, endDate, holidays]);

  // Validate based on policy settings
  useEffect(() => {
    const errors: string[] = [];

    if (!leaveType || !startDate || !endDate || totalDays <= 0) {
      setValidationErrors([]);
      return;
    }

    // Check advance request days (except for sick leave, lupa_absen, and izin khusus/life-event
    // yang sering tidak bisa direncanakan jauh hari, mis. duka atau melahirkan)
    if (leaveType !== "sakit" && leaveType !== "lupa_absen" && leaveType !== "izin_khusus") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selectedDate = new Date(startDate);
      const daysDiff = Math.floor((selectedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff < policy.min_days_advance_request) {
        errors.push(`Pengajuan cuti harus minimal ${policy.min_days_advance_request} hari sebelumnya`);
      }
    }

    // Check max consecutive days (izin khusus punya jatah tetap per-kejadian, di luar kebijakan ini)
    if (leaveType !== "izin_khusus" && totalDays > policy.max_consecutive_days) {
      errors.push(`Maksimal cuti berturut-turut adalah ${policy.max_consecutive_days} hari`);
    }

    // Izin khusus wajib pilih jenisnya, dan wajib lampirkan dokumen kalau disyaratkan
    if (leaveType === "izin_khusus") {
      if (!selectedSpecialType) {
        errors.push("Jenis izin khusus harus dipilih");
      } else if (selectedSpecialType.requires_document && !attachmentFile) {
        errors.push(`Lampiran dokumen pendukung wajib diunggah untuk "${selectedSpecialType.name}"`);
      }
    }

    // Check quota based on leave type
    if (leaveType === "cuti_tahunan") {
      if (isAnnualLeaveInactive) {
        errors.push("Cuti tahunan belum aktif. Masa kerja Anda belum genap 1 tahun.");
      } else {
        const remainingQuota = policy.annual_leave_quota - usedQuotas.annual;
        if (totalDays > remainingQuota) {
          errors.push(`Sisa kuota cuti tahunan tidak mencukupi. Tersisa: ${remainingQuota} hari`);
        }
      }
    } else if (leaveType === "sakit") {
      const remainingQuota = policy.sick_leave_quota - usedQuotas.sick;
      if (totalDays > remainingQuota) {
        errors.push(`Sisa kuota cuti sakit tidak mencukupi. Tersisa: ${remainingQuota} hari`);
      }
    } else if (leaveType === "izin") {
      const remainingQuota = policy.permission_quota - usedQuotas.permission;
      if (totalDays > remainingQuota) {
        errors.push(`Sisa kuota izin tidak mencukupi. Tersisa: ${remainingQuota} hari`);
      }
    }

    setValidationErrors(errors);
  }, [leaveType, startDate, endDate, totalDays, policy, usedQuotas, isAnnualLeaveInactive, selectedSpecialType, attachmentFile]);

  const getQuotaInfo = () => {
    return {
      annual: {
        total: policy.annual_leave_quota,
        used: usedQuotas.annual,
        remaining: policy.annual_leave_quota - usedQuotas.annual,
      },
      sick: {
        total: policy.sick_leave_quota,
        used: usedQuotas.sick,
        remaining: policy.sick_leave_quota - usedQuotas.sick,
      },
      permission: {
        total: policy.permission_quota,
        used: usedQuotas.permission,
        remaining: policy.permission_quota - usedQuotas.permission,
      },
    };
  };

  const quotaInfo = getQuotaInfo();

  const onSubmit = async (data: LeaveRequestFormData) => {
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
      let attachmentPath: string | null = null;

      if (data.leaveType === "izin_khusus" && attachmentFile && profile?.id) {
        const fileExt = attachmentFile.name.split(".").pop();
        const filePath = `${profile.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("leave-attachments")
          .upload(filePath, attachmentFile);
        if (uploadError) throw uploadError;
        attachmentPath = filePath;
      }

      const { error } = await supabase.from("leave_requests").insert([
        {
          user_id: profile?.id,
          leave_type: data.leaveType,
          special_leave_type_id: data.leaveType === "izin_khusus" ? data.specialLeaveTypeId : null,
          attachment_url: attachmentPath,
          start_date: data.startDate,
          end_date: data.endDate,
          total_days: totalDays,
          reason: data.reason || "",
          delegated_to: data.delegatedTo,
          delegation_notes: data.delegationNotes,
        } as any,
      ]);

      if (error) throw error;

      // Send notification to admins
      const leaveTypeName = formatLeaveTypeForNotification(data.leaveType);
      const notification = NotificationTemplates.leaveRequestSubmitted(
        profile?.full_name || 'Karyawan',
        leaveTypeName,
        totalDays
      );
      notifyAdmins(notification.title, notification.body, { type: 'leave_request' });

      toast({
        title: "Berhasil",
        description: "Pengajuan cuti berhasil dikirim dan menunggu persetujuan HRGA.",
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
            <CardTitle>Ajukan Cuti</CardTitle>
            <CardDescription>Isi formulir pengajuan cuti</CardDescription>
          </CardHeader>
          <CardContent>
            {isPolicyLoading ? (
              <p className="text-muted-foreground">Memuat kebijakan...</p>
            ) : (
              <>
                {/* Quota Info */}
                {isAnnualLeaveInactive && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      Cuti tahunan belum aktif karena masa kerja belum genap 1 tahun. Anda masih dapat mengajukan cuti sakit, izin, atau lupa absen.
                    </AlertDescription>
                  </Alert>
                )}

                <Alert className="mb-4">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <div className="text-xs space-y-1">
                      <p>Sisa Kuota Tahun Ini:</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {!isAnnualLeaveInactive && (
                          <span>Cuti Tahunan: <strong>{quotaInfo.annual.remaining}</strong>/{quotaInfo.annual.total} hari</span>
                        )}
                        <span>Sakit: <strong>{quotaInfo.sick.remaining}</strong>/{quotaInfo.sick.total} hari</span>
                        <span>Izin: <strong>{quotaInfo.permission.remaining}</strong>/{quotaInfo.permission.total} hari</span>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>

                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="leaveType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Jenis Cuti</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Pilih jenis cuti" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="cuti_tahunan" disabled={isAnnualLeaveInactive}>
                                Cuti Tahunan {isAnnualLeaveInactive ? "(Belum Aktif)" : `(Sisa: ${quotaInfo.annual.remaining} hari)`}
                              </SelectItem>
                              <SelectItem value="izin">
                                Izin (Sisa: {quotaInfo.permission.remaining} hari)
                              </SelectItem>
                              <SelectItem value="sakit">
                                Sakit (Sisa: {quotaInfo.sick.remaining} hari)
                              </SelectItem>
                              <SelectItem value="lupa_absen">Lupa Absen</SelectItem>
                              <SelectItem value="izin_khusus">Izin Khusus (pernikahan, duka, dll)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {leaveType === "izin_khusus" && (
                      <FormField
                        control={form.control}
                        name="specialLeaveTypeId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Jenis Izin Khusus</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Pilih jenis izin khusus" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {specialLeaveTypes.map((t) => (
                                  <SelectItem key={t.id} value={t.id}>
                                    {t.name} ({t.default_duration_days} hari)
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

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
                            <Input type="date" {...field} readOnly={leaveType === "izin_khusus"} />
                          </FormControl>
                          {leaveType === "izin_khusus" ? (
                            <p className="text-xs text-muted-foreground">
                              Total: {totalDays} hari (otomatis, jatah tetap untuk jenis izin ini)
                            </p>
                          ) : totalDays > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Total: {totalDays} hari kerja (tidak termasuk Sabtu, Minggu & libur nasional)
                            </p>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {leaveType === "izin_khusus" && selectedSpecialType?.requires_document && (
                      <div className="space-y-2">
                        <Label htmlFor="attachment" className="text-sm font-medium leading-none">
                          Lampiran Dokumen Pendukung <span className="text-destructive">*</span>
                        </Label>
                        <div className="flex items-center gap-2">
                          <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                          <Input
                            id="attachment"
                            type="file"
                            accept="image/*,.pdf"
                            onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Contoh: surat nikah, akta kelahiran/kematian, atau dokumen pendukung lainnya (gambar/PDF).
                        </p>
                      </div>
                    )}

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
                          <FormLabel>Alasan</FormLabel>
                          <FormControl>
                            <Textarea
                              rows={4}
                              placeholder="Tuliskan keterangan cuti, izin, sakit, atau jam kehadiran jika lupa absen..."
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {leaveType !== "lupa_absen" && (
                    <div className="border-t pt-4 space-y-4">
                      <div>
                        <p className="text-sm font-semibold">Pendelegasian Tugas</p>
                        <p className="text-xs text-muted-foreground">
                          Wajib diisi. Pilih rekan dari departemen <strong>{profile?.departemen}</strong> yang akan menggantikan tugas Anda selama cuti.
                        </p>
                      </div>

                      <FormField
                        control={form.control}
                        name="delegatedTo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Karyawan Pengganti</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder={colleagues.length === 0 ? "Tidak ada rekan di departemen Anda" : "Pilih karyawan pengganti"} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {colleagues.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.full_name} - {c.jabatan}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="delegationNotes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Detail Tugas yang Didelegasikan</FormLabel>
                            <FormControl>
                              <Textarea
                                rows={3}
                                placeholder="Tuliskan tugas-tugas yang akan didelegasikan selama cuti..."
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isSubmitting || validationErrors.length > 0}
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

export default LeaveRequest;
