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

// Official TER rates per PP 58/2023
// Kategori A: TK/0, TK/1, K/0
// Kategori B: TK/2, K/1, TK/3, K/2
// Kategori C: K/3

const TER_CATEGORY_A = [
  { min: 0, max: 5400000, rate: 0 },
  { min: 5400000, max: 5650000, rate: 0.25 },
  { min: 5650000, max: 5950000, rate: 0.5 },
  { min: 5950000, max: 6300000, rate: 0.75 },
  { min: 6300000, max: 6750000, rate: 1 },
  { min: 6750000, max: 7500000, rate: 1.25 },
  { min: 7500000, max: 8550000, rate: 1.5 },
  { min: 8550000, max: 9650000, rate: 1.75 },
  { min: 9650000, max: 10050000, rate: 2 },
  { min: 10050000, max: 10350000, rate: 2.25 },
  { min: 10350000, max: 10700000, rate: 2.5 },
  { min: 10700000, max: 11050000, rate: 3 },
  { min: 11050000, max: 11600000, rate: 3.5 },
  { min: 11600000, max: 12500000, rate: 4 },
  { min: 12500000, max: 13750000, rate: 5 },
  { min: 13750000, max: 15100000, rate: 6 },
  { min: 15100000, max: 16950000, rate: 7 },
  { min: 16950000, max: 19750000, rate: 8 },
  { min: 19750000, max: 24150000, rate: 9 },
  { min: 24150000, max: 26450000, rate: 10 },
  { min: 26450000, max: 28000000, rate: 11 },
  { min: 28000000, max: 30050000, rate: 12 },
  { min: 30050000, max: 32400000, rate: 13 },
  { min: 32400000, max: 35400000, rate: 14 },
  { min: 35400000, max: 39100000, rate: 15 },
  { min: 39100000, max: 43850000, rate: 16 },
  { min: 43850000, max: 47800000, rate: 17 },
  { min: 47800000, max: 51400000, rate: 18 },
  { min: 51400000, max: 56300000, rate: 19 },
  { min: 56300000, max: 62200000, rate: 20 },
  { min: 62200000, max: 68600000, rate: 21 },
  { min: 68600000, max: 77500000, rate: 22 },
  { min: 77500000, max: 89000000, rate: 23 },
  { min: 89000000, max: 103000000, rate: 24 },
  { min: 103000000, max: 125000000, rate: 25 },
  { min: 125000000, max: 157000000, rate: 26 },
  { min: 157000000, max: 206000000, rate: 27 },
  { min: 206000000, max: 337000000, rate: 28 },
  { min: 337000000, max: 454000000, rate: 29 },
  { min: 454000000, max: 550000000, rate: 30 },
  { min: 550000000, max: 695000000, rate: 31 },
  { min: 695000000, max: 910000000, rate: 32 },
  { min: 910000000, max: 1400000000, rate: 33 },
  { min: 1400000000, max: 99999999999, rate: 34 },
];

const TER_CATEGORY_B = [
  { min: 0, max: 6200000, rate: 0 },
  { min: 6200000, max: 6500000, rate: 0.25 },
  { min: 6500000, max: 6850000, rate: 0.5 },
  { min: 6850000, max: 7300000, rate: 0.75 },
  { min: 7300000, max: 9200000, rate: 1 },
  { min: 9200000, max: 10750000, rate: 1.5 },
  { min: 10750000, max: 11250000, rate: 2 },
  { min: 11250000, max: 11600000, rate: 2.5 },
  { min: 11600000, max: 12600000, rate: 3 },
  { min: 12600000, max: 13600000, rate: 4 },
  { min: 13600000, max: 14950000, rate: 5 },
  { min: 14950000, max: 16400000, rate: 6 },
  { min: 16400000, max: 18450000, rate: 7 },
  { min: 18450000, max: 21850000, rate: 8 },
  { min: 21850000, max: 26000000, rate: 9 },
  { min: 26000000, max: 27700000, rate: 10 },
  { min: 27700000, max: 29350000, rate: 11 },
  { min: 29350000, max: 31450000, rate: 12 },
  { min: 31450000, max: 33950000, rate: 13 },
  { min: 33950000, max: 37100000, rate: 14 },
  { min: 37100000, max: 41100000, rate: 15 },
  { min: 41100000, max: 45800000, rate: 16 },
  { min: 45800000, max: 49500000, rate: 17 },
  { min: 49500000, max: 53800000, rate: 18 },
  { min: 53800000, max: 58500000, rate: 19 },
  { min: 58500000, max: 64000000, rate: 20 },
  { min: 64000000, max: 71000000, rate: 21 },
  { min: 71000000, max: 80000000, rate: 22 },
  { min: 80000000, max: 93000000, rate: 23 },
  { min: 93000000, max: 109000000, rate: 24 },
  { min: 109000000, max: 129000000, rate: 25 },
  { min: 129000000, max: 163000000, rate: 26 },
  { min: 163000000, max: 211000000, rate: 27 },
  { min: 211000000, max: 374000000, rate: 28 },
  { min: 374000000, max: 459000000, rate: 29 },
  { min: 459000000, max: 555000000, rate: 30 },
  { min: 555000000, max: 704000000, rate: 31 },
  { min: 704000000, max: 957000000, rate: 32 },
  { min: 957000000, max: 1405000000, rate: 33 },
  { min: 1405000000, max: 99999999999, rate: 34 },
];

const TER_CATEGORY_C = [
  { min: 0, max: 6600000, rate: 0 },
  { min: 6600000, max: 6950000, rate: 0.25 },
  { min: 6950000, max: 7350000, rate: 0.5 },
  { min: 7350000, max: 7800000, rate: 0.75 },
  { min: 7800000, max: 8850000, rate: 1 },
  { min: 8850000, max: 9800000, rate: 1.25 },
  { min: 9800000, max: 10950000, rate: 1.5 },
  { min: 10950000, max: 11200000, rate: 1.75 },
  { min: 11200000, max: 12050000, rate: 2 },
  { min: 12050000, max: 12950000, rate: 3 },
  { min: 12950000, max: 14150000, rate: 4 },
  { min: 14150000, max: 15550000, rate: 5 },
  { min: 15550000, max: 17050000, rate: 6 },
  { min: 17050000, max: 19500000, rate: 7 },
  { min: 19500000, max: 22700000, rate: 8 },
  { min: 22700000, max: 26600000, rate: 9 },
  { min: 26600000, max: 28100000, rate: 10 },
  { min: 28100000, max: 30100000, rate: 11 },
  { min: 30100000, max: 32600000, rate: 12 },
  { min: 32600000, max: 35400000, rate: 13 },
  { min: 35400000, max: 38900000, rate: 14 },
  { min: 38900000, max: 43000000, rate: 15 },
  { min: 43000000, max: 47400000, rate: 16 },
  { min: 47400000, max: 51200000, rate: 17 },
  { min: 51200000, max: 55800000, rate: 18 },
  { min: 55800000, max: 60400000, rate: 19 },
  { min: 60400000, max: 66700000, rate: 20 },
  { min: 66700000, max: 74500000, rate: 21 },
  { min: 74500000, max: 83200000, rate: 22 },
  { min: 83200000, max: 95600000, rate: 23 },
  { min: 95600000, max: 110000000, rate: 24 },
  { min: 110000000, max: 134000000, rate: 25 },
  { min: 134000000, max: 169000000, rate: 26 },
  { min: 169000000, max: 221000000, rate: 27 },
  { min: 221000000, max: 390000000, rate: 28 },
  { min: 390000000, max: 463000000, rate: 29 },
  { min: 463000000, max: 561000000, rate: 30 },
  { min: 561000000, max: 709000000, rate: 31 },
  { min: 709000000, max: 965000000, rate: 32 },
  { min: 965000000, max: 1419000000, rate: 33 },
  { min: 1419000000, max: 99999999999, rate: 34 },
];

// PTKP to TER Category mapping per PP 58/2023
const PTKP_TO_CATEGORY: Record<string, typeof TER_CATEGORY_A> = {
  "TK/0": TER_CATEGORY_A,
  "TK/1": TER_CATEGORY_A,
  "K/0": TER_CATEGORY_A,
  "TK/2": TER_CATEGORY_B,
  "K/1": TER_CATEGORY_B,
  "TK/3": TER_CATEGORY_B,
  "K/2": TER_CATEGORY_B,
  "K/3": TER_CATEGORY_C,
};

const buildDefaultRates = (): Omit<TERRate, "id" | "created_at">[] => {
  const result: Omit<TERRate, "id" | "created_at">[] = [];
  for (const ptkp of PTKP_CATEGORIES) {
    const brackets = PTKP_TO_CATEGORY[ptkp];
    if (!brackets) continue;
    for (const b of brackets) {
      result.push({
        kategori_ptkp: ptkp,
        bruto_min: b.min,
        bruto_max: b.max,
        tarif_efektif: b.rate,
      });
    }
  }
  return result;
};

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
      const allRates = buildDefaultRates();
      // Insert in batches of 100 to avoid payload limits
      for (let i = 0; i < allRates.length; i += 100) {
        const batch = allRates.slice(i, i + 100);
        const { error } = await supabase.from("pph21_ter_rates").insert(batch as any);
        if (error) throw error;
      }
      toast({ title: "Berhasil", description: `${allRates.length} tarif TER default (semua kategori PTKP) berhasil ditambahkan.` });
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
            <Button variant="outline" onClick={handleSeedDefaults} disabled={seeding} className="gap-2">
              {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Muat Tarif Default (Semua Kategori)
            </Button>
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
