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

// Helper to generate TER rates for a category with adjusted thresholds
const generateCategoryRates = (kategori: string, offset: number): Omit<TERRate, "id" | "created_at">[] => {
  const base = [
    { min: 0, max: 5400000, rate: 0 },
    { min: 5400001, max: 5650000, rate: 0.25 },
    { min: 5650001, max: 5950000, rate: 0.5 },
    { min: 5950001, max: 6300000, rate: 0.75 },
    { min: 6300001, max: 6750000, rate: 1 },
    { min: 6750001, max: 7500000, rate: 1.25 },
    { min: 7500001, max: 8550000, rate: 1.5 },
    { min: 8550001, max: 9650000, rate: 1.75 },
    { min: 9650001, max: 10050000, rate: 2 },
    { min: 10050001, max: 10350000, rate: 2.25 },
    { min: 10350001, max: 10700000, rate: 2.5 },
    { min: 10700001, max: 11050000, rate: 3 },
    { min: 11050001, max: 11600000, rate: 3.5 },
    { min: 11600001, max: 12500000, rate: 4 },
    { min: 12500001, max: 13750000, rate: 5 },
    { min: 13750001, max: 15100000, rate: 6 },
    { min: 15100001, max: 16950000, rate: 7 },
    { min: 16950001, max: 19750000, rate: 8 },
    { min: 19750001, max: 24150000, rate: 9 },
    { min: 24150001, max: 26450000, rate: 10 },
    { min: 26450001, max: 28000000, rate: 11 },
    { min: 28000001, max: 30050000, rate: 12 },
    { min: 30050001, max: 32400000, rate: 13 },
    { min: 32400001, max: 35400000, rate: 14 },
    { min: 35400001, max: 39100000, rate: 15 },
    { min: 39100001, max: 43850000, rate: 16 },
    { min: 43850001, max: 47800000, rate: 17 },
    { min: 47800001, max: 51400000, rate: 18 },
    { min: 51400001, max: 56300000, rate: 19 },
    { min: 56300001, max: 62200000, rate: 20 },
    { min: 62200001, max: 68600000, rate: 21 },
    { min: 68600001, max: 77500000, rate: 22 },
    { min: 77500001, max: 89000000, rate: 23 },
    { min: 89000001, max: 103000000, rate: 24 },
    { min: 103000001, max: 125000000, rate: 25 },
    { min: 125000001, max: 157000000, rate: 26 },
    { min: 157000001, max: 206000000, rate: 27 },
    { min: 206000001, max: 337000000, rate: 28 },
    { min: 337000001, max: 454000000, rate: 29 },
    { min: 454000001, max: 550000000, rate: 30 },
    { min: 550000001, max: 695000000, rate: 31 },
    { min: 695000001, max: 910000000, rate: 32 },
    { min: 910000001, max: 1400000000, rate: 33 },
    { min: 1400000001, max: 999999999999, rate: 34 },
  ];
  return base.map(b => ({
    kategori_ptkp: kategori,
    bruto_min: Math.max(0, b.min + offset),
    bruto_max: b.max === 999999999999 ? 999999999999 : b.max + offset,
    tarif_efektif: b.rate,
  }));
};

// Default TER rates for all PTKP categories based on PP 58/2023
const DEFAULT_TER_RATES: Omit<TERRate, "id" | "created_at">[] = [
  ...generateCategoryRates("TK/0", 0),
  ...generateCategoryRates("TK/1", 350000),
  ...generateCategoryRates("TK/2", 700000),
  ...generateCategoryRates("TK/3", 1050000),
  ...generateCategoryRates("K/0", 350000),
  ...generateCategoryRates("K/1", 700000),
  ...generateCategoryRates("K/2", 1050000),
  ...generateCategoryRates("K/3", 1400000),
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
      // Insert in batches of 100 to avoid payload limits
      for (let i = 0; i < DEFAULT_TER_RATES.length; i += 100) {
        const batch = DEFAULT_TER_RATES.slice(i, i + 100);
        const { error } = await supabase.from("pph21_ter_rates").insert(batch as any);
        if (error) throw error;
      }
      toast({ title: "Berhasil", description: `${DEFAULT_TER_RATES.length} tarif TER default (semua kategori PTKP) berhasil ditambahkan.` });
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
