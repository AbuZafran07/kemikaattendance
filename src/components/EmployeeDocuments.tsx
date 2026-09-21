import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Upload, Download, Trash2, FileText, Plus } from "lucide-react";

const CATEGORIES = [
  "KTP",
  "NPWP",
  "Ijazah",
  "Sertifikat",
  "Kartu Keluarga",
  "BPJS Kesehatan",
  "BPJS Ketenagakerjaan",
  "Kontrak Kerja",
  "Surat Peringatan",
  "Lainnya",
];

interface Props {
  employeeId: string;
}

interface DocRow {
  id: string;
  category: string;
  title: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  issued_date: string | null;
  expiry_date: string | null;
  notes: string | null;
  created_at: string;
}

export const EmployeeDocuments = ({ employeeId }: Props) => {
  const { toast } = useToast();
  const { profile } = useAuth();
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    category: "KTP",
    title: "",
    issued_date: "",
    expiry_date: "",
    notes: "",
    file: null as File | null,
  });

  const fetchDocs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("employee_documents")
      .select("*")
      .eq("user_id", employeeId)
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Gagal memuat dokumen", description: error.message, variant: "destructive" });
    } else {
      setDocs((data || []) as DocRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (employeeId) fetchDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  const handleUpload = async () => {
    if (!form.file || !form.title.trim()) {
      toast({ title: "Judul & file wajib diisi", variant: "destructive" });
      return;
    }
    if (form.file.size > 10 * 1024 * 1024) {
      toast({ title: "Ukuran file maksimal 10MB", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const ext = form.file.name.split(".").pop() || "bin";
      const path = `${employeeId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("employee-documents")
        .upload(path, form.file, { contentType: form.file.type, upsert: false });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("employee_documents").insert({
        user_id: employeeId,
        category: form.category,
        title: form.title.trim(),
        file_path: path,
        file_size: form.file.size,
        mime_type: form.file.type,
        issued_date: form.issued_date || null,
        expiry_date: form.expiry_date || null,
        notes: form.notes.trim() || null,
        uploaded_by: profile?.id,
      });
      if (insErr) throw insErr;

      toast({ title: "Dokumen berhasil diupload" });
      setUploadOpen(false);
      setForm({ category: "KTP", title: "", issued_date: "", expiry_date: "", notes: "", file: null });
      fetchDocs();
    } catch (e: any) {
      toast({ title: "Gagal upload", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc: DocRow) => {
    const { data, error } = await supabase.storage
      .from("employee-documents")
      .createSignedUrl(doc.file_path, 60);
    if (error || !data?.signedUrl) {
      toast({ title: "Gagal membuka file", description: error?.message, variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const handleDelete = async (doc: DocRow) => {
    if (!confirm(`Hapus dokumen "${doc.title}"?`)) return;
    const { error: sErr } = await supabase.storage.from("employee-documents").remove([doc.file_path]);
    if (sErr) console.warn(sErr);
    const { error } = await supabase.from("employee_documents").delete().eq("id", doc.id);
    if (error) {
      toast({ title: "Gagal menghapus", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Dokumen dihapus" });
      fetchDocs();
    }
  };

  const expiryBadge = (d: string | null) => {
    if (!d) return null;
    const days = Math.ceil((new Date(d + "T00:00:00").getTime() - Date.now()) / 86400000);
    if (days < 0) return <Badge variant="destructive">Kedaluwarsa</Badge>;
    if (days <= 30) return <Badge className="bg-amber-500">{days} hari lagi</Badge>;
    return <Badge variant="secondary">Aktif</Badge>;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Total: {docs.length} dokumen</p>
        <Button size="sm" onClick={() => setUploadOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Upload
        </Button>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-8">Memuat dokumen...</p>
      ) : docs.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">Belum ada dokumen.</p>
      ) : (
        <div className="max-h-[420px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kategori</TableHead>
                <TableHead>Judul</TableHead>
                <TableHead>Terbit</TableHead>
                <TableHead>Kedaluwarsa</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map((d) => (
                <TableRow key={d.id}>
                  <TableCell><Badge variant="outline">{d.category}</Badge></TableCell>
                  <TableCell className="font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>{d.title}</span>
                  </TableCell>
                  <TableCell className="text-xs">
                    {d.issued_date ? new Date(d.issued_date).toLocaleDateString("id-ID") : "-"}
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="flex flex-col gap-1">
                      <span>{d.expiry_date ? new Date(d.expiry_date).toLocaleDateString("id-ID") : "-"}</span>
                      {expiryBadge(d.expiry_date)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => handleDownload(d)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(d)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Dokumen Karyawan</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Judul Dokumen *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Contoh: KTP - Budi Santoso" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Tgl Terbit</Label>
                <Input type="date" value={form.issued_date} onChange={(e) => setForm({ ...form, issued_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Tgl Kedaluwarsa</Label>
                <Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>File * (max 10MB, PDF/JPG/PNG)</Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)} disabled={uploading}>Batal</Button>
            <Button onClick={handleUpload} disabled={uploading}>
              <Upload className="h-4 w-4 mr-1" />
              {uploading ? "Mengupload..." : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
