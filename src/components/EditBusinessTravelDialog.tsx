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
    user_id?: string;
    destination: string;
    purpose: string;
    start_date: string;
    end_date: string;
    notes: string | null;
    ca_document_url?: string | null;
    ca_number?: string | null;
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
  const [caFile, setCaFile] = useState<File | null>(null);
  const [caNumber, setCaNumber] = useState(request.ca_number || "");

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
    setCaNumber(request.ca_number || "");
    setCaFile(null);
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
      const patch: Record<string, any> = {
        destination: data.destination,
        purpose: data.purpose,
        start_date: data.startDate,
        end_date: data.endDate,
        total_days: totalDays,
        notes: data.notes || null,
        ca_number: caNumber.trim() || null,
      };

      // Upload / ganti dokumen CA bila dipilih
      if (caFile) {
        if (caFile.size > 10 * 1024 * 1024) {
          toast.error("Dokumen CA maksimal 10 MB");
          setIsSubmitting(false);
          return;
        }
        const ext = caFile.name.split(".").pop();
        const folder = request.user_id || "shared";
        const path = `${folder}/ca_${request.id}_${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("business-travel-docs")
          .upload(path, caFile);
        if (upErr) throw upErr;
        patch.ca_document_url = path;
        patch.ca_uploaded_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("business_travel_requests")
        .update(patch as any)
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

            <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3">
              <div className="space-y-1">
                <FormLabel>Nomor CA (Cash Advance)</FormLabel>
                <Input
                  placeholder="Contoh: CA/2026/09/001"
                  value={caNumber}
                  onChange={(e) => setCaNumber(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <FormLabel>
                  Dokumen CA {request.ca_document_url ? "(sudah ada — pilih file untuk mengganti)" : "(belum ada)"}
                </FormLabel>
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={(e) => setCaFile(e.target.files?.[0] || null)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Tunjangan perjalanan dinas hanya dibayarkan bila dokumen CA dilampirkan.
              </p>
            </div>

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
