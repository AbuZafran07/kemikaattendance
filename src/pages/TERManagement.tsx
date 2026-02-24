import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, Loader2, FileText, Upload } from "lucide-react";
import { formatRupiah } from "@/lib/payrollCalculation";

interface TERRate {
  id: string;
  kategori_ptkp: string;
  bruto_min: number;
  bruto_max: number;
  tarif_efektif: number;
  created_at: string;
}

const PTKP_CATEGORIES = [
  "TK/0", "TK/1", "TK/2", "TK/3",
  "K/0", "K/1", "K/2", "K/3",
];

// Default TER rates based on PP 58/2023 (simplified representative sample)
const DEFAULT_TER_RATES: Omit<TERRate, "id" | "created_at">[] = [
  // TK/0 - Kategori A
  { kategori_ptkp: "TK/0", bruto_min: 0, bruto_max: 5400000, tarif_efektif: 0 },
  { kategori_ptkp: "TK/0", bruto_min: 5400001, bruto_max: 5650000, tarif_efektif: 0.25 },
  { kategori_ptkp: "TK/0", bruto_min: 5650001, bruto_max: 5950000, tarif_efektif: 0.5 },
  { kategori_ptkp: "TK/0", bruto_min: 5950001, bruto_max: 6300000, tarif_efektif: 0.75 },
  { kategori_ptkp: "TK/0", bruto_min: 6300001, bruto_max: 6750000, tarif_efektif: 1 },
  { kategori_ptkp: "TK/0", bruto_min: 6750001, bruto_max: 7500000, tarif_efektif: 1.25 },
  { kategori_ptkp: "TK/0", bruto_min: 7500001, bruto_max: 8550000, tarif_efektif: 1.5 },
  { kategori_ptkp: "TK/0", bruto_min: 8550001, bruto_max: 9650000, tarif_efektif: 1.75 },
  { kategori_ptkp: "TK/0", bruto_min: 9650001, bruto_max: 10050000, tarif_efektif: 2 },
  { kategori_ptkp: "TK/0", bruto_min: 10050001, bruto_max: 10350000, tarif_efektif: 2.25 },
  { kategori_ptkp: "TK/0", bruto_min: 10350001, bruto_max: 10700000, tarif_efektif: 2.5 },
  { kategori_ptkp: "TK/0", bruto_min: 10700001, bruto_max: 11050000, tarif_efektif: 3 },
  { kategori_ptkp: "TK/0", bruto_min: 11050001, bruto_max: 11600000, tarif_efektif: 3.5 },
  { kategori_ptkp: "TK/0", bruto_min: 11600001, bruto_max: 12500000, tarif_efektif: 4 },
  { kategori_ptkp: "TK/0", bruto_min: 12500001, bruto_max: 13750000, tarif_efektif: 5 },
  { kategori_ptkp: "TK/0", bruto_min: 13750001, bruto_max: 15100000, tarif_efektif: 6 },
  { kategori_ptkp: "TK/0", bruto_min: 15100001, bruto_max: 16950000, tarif_efektif: 7 },
  { kategori_ptkp: "TK/0", bruto_min: 16950001, bruto_max: 19750000, tarif_efektif: 8 },
  { kategori_ptkp: "TK/0", bruto_min: 19750001, bruto_max: 24150000, tarif_efektif: 9 },
  { kategori_ptkp: "TK/0", bruto_min: 24150001, bruto_max: 26450000, tarif_efektif: 10 },
  { kategori_ptkp: "TK/0", bruto_min: 26450001, bruto_max: 28000000, tarif_efektif: 11 },
  { kategori_ptkp: "TK/0", bruto_min: 28000001, bruto_max: 30050000, tarif_efektif: 12 },
  { kategori_ptkp: "TK/0", bruto_min: 30050001, bruto_max: 32400000, tarif_efektif: 13 },
  { kategori_ptkp: "TK/0", bruto_min: 32400001, bruto_max: 35400000, tarif_efektif: 14 },
  { kategori_ptkp: "TK/0", bruto_min: 35400001, bruto_max: 39100000, tarif_efektif: 15 },
  { kategori_ptkp: "TK/0", bruto_min: 39100001, bruto_max: 43850000, tarif_efektif: 16 },
  { kategori_ptkp: "TK/0", bruto_min: 43850001, bruto_max: 47800000, tarif_efektif: 17 },
  { kategori_ptkp: "TK/0", bruto_min: 47800001, bruto_max: 51400000, tarif_efektif: 18 },
  { kategori_ptkp: "TK/0", bruto_min: 51400001, bruto_max: 56300000, tarif_efektif: 19 },
  { kategori_ptkp: "TK/0", bruto_min: 56300001, bruto_max: 62200000, tarif_efektif: 20 },
  { kategori_ptkp: "TK/0", bruto_min: 62200001, bruto_max: 68600000, tarif_efektif: 21 },
  { kategori_ptkp: "TK/0", bruto_min: 68600001, bruto_max: 77500000, tarif_efektif: 22 },
  { kategori_ptkp: "TK/0", bruto_min: 77500001, bruto_max: 89000000, tarif_efektif: 23 },
  { kategori_ptkp: "TK/0", bruto_min: 89000001, bruto_max: 103000000, tarif_efektif: 24 },
  { kategori_ptkp: "TK/0", bruto_min: 103000001, bruto_max: 125000000, tarif_efektif: 25 },
  { kategori_ptkp: "TK/0", bruto_min: 125000001, bruto_max: 157000000, tarif_efektif: 26 },
  { kategori_ptkp: "TK/0", bruto_min: 157000001, bruto_max: 206000000, tarif_efektif: 27 },
  { kategori_ptkp: "TK/0", bruto_min: 206000001, bruto_max: 337000000, tarif_efektif: 28 },
  { kategori_ptkp: "TK/0", bruto_min: 337000001, bruto_max: 454000000, tarif_efektif: 29 },
  { kategori_ptkp: "TK/0", bruto_min: 454000001, bruto_max: 550000000, tarif_efektif: 30 },
  { kategori_ptkp: "TK/0", bruto_min: 550000001, bruto_max: 695000000, tarif_efektif: 31 },
  { kategori_ptkp: "TK/0", bruto_min: 695000001, bruto_max: 910000000, tarif_efektif: 32 },
  { kategori_ptkp: "TK/0", bruto_min: 910000001, bruto_max: 1400000000, tarif_efektif: 33 },
  { kategori_ptkp: "TK/0", bruto_min: 1400000001, bruto_max: 999999999999, tarif_efektif: 34 },
];

const TERManagement = () => {
  const [rates, setRates] = useState<TERRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [showDialog, setShowDialog] = useState(false);
  const [editingRate, setEditingRate] = useState<TERRate | null>(null);
  const [formData, setFormData] = useState({ kategori_ptkp: "TK/0", bruto_min: "", bruto_max: "", tarif_efektif: "" });
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const { toast } = useToast();

  useEffect(() => { fetchRates(); }, []);

  const fetchRates = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("pph21_ter_rates")
      .select("*")
      .order("kategori_ptkp")
      .order("bruto_min");
    if (error) {
      toast({ title: "Gagal memuat data TER", description: error.message, variant: "destructive" });
    }
    setRates((data as TERRate[]) || []);
    setLoading(false);
  };

  const handleSeedDefaults = async () => {
    setSeeding(true);
    try {
      const { error } = await supabase.from("pph21_ter_rates").insert(DEFAULT_TER_RATES as any);
      if (error) throw error;
      toast({ title: "Berhasil", description: `${DEFAULT_TER_RATES.length} tarif TER default (TK/0) berhasil ditambahkan.` });
      fetchRates();
    } catch (e: any) {
      toast({ title: "Gagal", description: e.message, variant: "destructive" });
    } finally {
      setSeeding(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingRate(null);
    setFormData({ kategori_ptkp: "TK/0", bruto_min: "", bruto_max: "", tarif_efektif: "" });
    setShowDialog(true);
  };

  const handleOpenEdit = (rate: TERRate) => {
    setEditingRate(rate);
    setFormData({
      kategori_ptkp: rate.kategori_ptkp,
      bruto_min: String(rate.bruto_min),
      bruto_max: String(rate.bruto_max),
      tarif_efektif: String(rate.tarif_efektif),
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        kategori_ptkp: formData.kategori_ptkp,
        bruto_min: Number(formData.bruto_min) || 0,
        bruto_max: Number(formData.bruto_max) || 0,
        tarif_efektif: Number(formData.tarif_efektif) || 0,
      };

      if (editingRate) {
        const { error } = await supabase.from("pph21_ter_rates").update(payload).eq("id", editingRate.id);
        if (error) throw error;
        toast({ title: "Tarif TER diperbarui" });
      } else {
        const { error } = await supabase.from("pph21_ter_rates").insert(payload as any);
        if (error) throw error;
        toast({ title: "Tarif TER ditambahkan" });
      }
      setShowDialog(false);
      fetchRates();
    } catch (e: any) {
      toast({ title: "Gagal", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus tarif TER ini?")) return;
    const { error } = await supabase.from("pph21_ter_rates").delete().eq("id", id);
    if (error) {
      toast({ title: "Gagal menghapus", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Tarif TER dihapus" });
      fetchRates();
    }
  };

  const filteredRates = filterCategory === "all" ? rates : rates.filter(r => r.kategori_ptkp === filterCategory);
  const categoryCounts = PTKP_CATEGORIES.map(c => ({ cat: c, count: rates.filter(r => r.kategori_ptkp === c).length }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-7 w-7 text-primary" /> Manajemen Tarif TER PPh 21
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Kelola tarif efektif rata-rata (TER) sesuai PP 58/2023 untuk perhitungan PPh 21 bulanan (Januari–November)
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {rates.length === 0 && (
              <Button variant="outline" onClick={handleSeedDefaults} disabled={seeding} className="gap-2">
                {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Muat Tarif Default (TK/0)
              </Button>
            )}
            <Button onClick={handleOpenAdd} className="gap-2">
              <Plus className="h-4 w-4" /> Tambah Tarif
            </Button>
          </div>
        </div>

        {/* Category summary */}
        <div className="flex flex-wrap gap-2">
          <Badge
            variant={filterCategory === "all" ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setFilterCategory("all")}
          >
            Semua ({rates.length})
          </Badge>
          {categoryCounts.map(({ cat, count }) => (
            <Badge
              key={cat}
              variant={filterCategory === cat ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setFilterCategory(cat)}
            >
              {cat} ({count})
            </Badge>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tabel Tarif TER</CardTitle>
            <CardDescription>
              Tarif ini digunakan untuk menghitung PPh 21 bulanan (Jan–Nov). Bulan Desember menggunakan rekonsiliasi tarif progresif.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : filteredRates.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Belum ada tarif TER</p>
                <p className="text-sm mt-1">Klik "Muat Tarif Default" untuk mengisi tarif TER standar atau tambahkan secara manual.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">No</TableHead>
                      <TableHead>Kategori PTKP</TableHead>
                      <TableHead className="text-right">Bruto Min</TableHead>
                      <TableHead className="text-right">Bruto Max</TableHead>
                      <TableHead className="text-right">Tarif Efektif (%)</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRates.map((rate, idx) => (
                      <TableRow key={rate.id}>
                        <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell><Badge variant="outline">{rate.kategori_ptkp}</Badge></TableCell>
                        <TableCell className="text-right">{formatRupiah(rate.bruto_min)}</TableCell>
                        <TableCell className="text-right">{formatRupiah(rate.bruto_max)}</TableCell>
                        <TableCell className="text-right font-medium">{rate.tarif_efektif}%</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenEdit(rate)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(rate.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add/Edit Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingRate ? "Edit Tarif TER" : "Tambah Tarif TER"}</DialogTitle>
              <DialogDescription>Masukkan data tarif efektif rata-rata sesuai regulasi DJP.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Kategori PTKP</Label>
                <Select value={formData.kategori_ptkp} onValueChange={(v) => setFormData(prev => ({ ...prev, kategori_ptkp: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PTKP_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Bruto Minimum (Rp)</Label>
                  <Input type="number" value={formData.bruto_min} placeholder="0"
                    onChange={(e) => setFormData(prev => ({ ...prev, bruto_min: e.target.value }))} />
                </div>
                <div>
                  <Label>Bruto Maksimum (Rp)</Label>
                  <Input type="number" value={formData.bruto_max} placeholder="0"
                    onChange={(e) => setFormData(prev => ({ ...prev, bruto_max: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Tarif Efektif (%)</Label>
                <Input type="number" step="0.01" value={formData.tarif_efektif} placeholder="0"
                  onChange={(e) => setFormData(prev => ({ ...prev, tarif_efektif: e.target.value }))} />
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {editingRate ? "Simpan Perubahan" : "Tambah Tarif"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default TERManagement;
