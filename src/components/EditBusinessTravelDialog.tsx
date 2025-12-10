import { useState, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

interface EditBusinessTravelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: {
    id: string;
    destination: string;
    purpose: string;
    start_date: string;
    end_date: string;
    notes: string | null;
  };
  onUpdated: () => void;
}

export const EditBusinessTravelDialog = ({
  open,
  onOpenChange,
  request,
  onUpdated,
}: EditBusinessTravelDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<BusinessTravelFormData>({
    resolver: zodResolver(businessTravelSchema),
    defaultValues: {
      destination: request.destination,
      purpose: request.purpose,
      startDate: request.start_date,
      endDate: request.end_date,
      notes: request.notes || "",
    },
  });

  useEffect(() => {
    form.reset({
      destination: request.destination,
      purpose: request.purpose,
      startDate: request.start_date,
      endDate: request.end_date,
      notes: request.notes || "",
    });
  }, [request, form]);

  const startDate = form.watch("startDate");
  const endDate = form.watch("endDate");

  const totalDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }, [startDate, endDate]);

  const onSubmit = async (data: BusinessTravelFormData) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("business_travel_requests")
        .update({
          destination: data.destination,
          purpose: data.purpose,
          start_date: data.startDate,
          end_date: data.endDate,
          total_days: totalDays,
          notes: data.notes || null,
        })
        .eq("id", request.id);

      if (error) throw error;

      toast.success("Pengajuan berhasil diperbarui");
      onUpdated();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error updating request:", error);
      toast.error("Gagal memperbarui pengajuan");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Pengajuan Perjalanan Dinas</DialogTitle>
          <DialogDescription>Perbarui detail pengajuan perjalanan dinas</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="destination"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tujuan</FormLabel>
                  <FormControl>
                    <Input placeholder="Contoh: Surabaya, Jakarta, dll" {...field} />
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
                    <Textarea rows={3} placeholder="Jelaskan keperluan perjalanan dinas..." {...field} />
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
                    <p className="text-xs text-muted-foreground">Total: {totalDays} hari</p>
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
                    <Textarea rows={2} placeholder="Catatan tambahan jika ada..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                Batal
              </Button>
              <Button type="submit" className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
