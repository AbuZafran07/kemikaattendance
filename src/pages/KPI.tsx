import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Target, Plus, Trash2, Save, TrendingUp, Users,
  Award, DollarSign, ChevronDown, ChevronUp, Loader2
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ThresholdRule { op: "=" | "<" | "<=" | ">" | ">="; val: number; score: number; }
interface CustomVar { lbl: string; }

interface KpiIndicator {
  id: string;
  user_id: string;
  year: number;
  name: string;
  description: string;
  weight: number;
  target: string;
  unit: string;
  formula_type: "ratio" | "akumulasi" | "avg" | "lower" | "threshold" | "custom";
  thresholds: ThresholdRule[];
  custom_vars: CustomVar[];
  custom_expr: string;
  sort_order: number;
}

interface KpiRealization {
  id?: string;
  indicator_id: string;
  user_id: string;
  month: number;
  year: number;
  value?: number | null;
  custom_values?: Record<string, number>;
}

interface KpiGrade { id: string; grade: string; min_score: number; bonus_percent: number; }
interface Employee { id: string; full_name: string; position?: string; department?: string; basic_salary?: number; }

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];

const FORMULA_TYPES = [
  { v: "ratio",      lbl: "Rasio (Realisasi / Target × 100)",         hint: "Contoh: rekrutmen tepat waktu, ontime payroll" },
  { v: "akumulasi",  lbl: "Akumulasi bulanan (jumlah)",                hint: "Contoh: jumlah pelatihan, jumlah rekrutmen" },
  { v: "avg",        lbl: "Rata-rata bulanan",                         hint: "Contoh: kepuasan karyawan, compliance rate" },
  { v: "lower",      lbl: "Lower is better (Target / Realisasi × 100)",hint: "Contoh: turn over, error rate, keluhan" },
  { v: "threshold",  lbl: "Threshold / range nilai",                   hint: "Contoh: 0 kasus=100%, 1-2=50%, >2=0%" },
  { v: "custom",     lbl: "Formula kustom (variabel bebas)",           hint: "Contoh: (jumlah ikut / total) × 100" },
];

// ─── Score Engine ─────────────────────────────────────────────────────────────

function computeScore(ind: KpiIndicator, realizations: KpiRealization[]): { score: number | null; realVal: number | null; filledCount: number } {
  const tgtNum = parseFloat(ind.target) || 0;
  const reals = realizations.filter(r => r.indicator_id === ind.id);

  if (ind.formula_type === "custom") {
    const cvars = ind.custom_vars || [];
    let lastMonth: KpiRealization | null = null;
    for (let mi = 11; mi >= 0; mi--) {
      const r = reals.find(x => x.month === mi);
      if (r && cvars.every((_, vi) => r.custom_values?.[`v${vi}`] !== undefined)) {
        lastMonth = r; break;
      }
    }
    if (!lastMonth) return { score: null, realVal: null, filledCount: reals.length };
    try {
      let expr = ind.custom_expr || "0";
      (ind.custom_vars || []).forEach((_, vi) => {
        expr = expr.replaceAll(`v${vi}`, String(lastMonth!.custom_values?.[`v${vi}`] ?? 0));
      });
      // eslint-disable-next-line no-new-func
      const realVal = Function('"use strict";return (' + expr + ')')() as number;
      const score = tgtNum ? Math.min((realVal / tgtNum) * 100, 120) : null;
      return { score, realVal, filledCount: reals.length };
    } catch { return { score: null, realVal: null, filledCount: reals.length }; }
  }

  const filled = reals.filter(r => r.value !== null && r.value !== undefined).map(r => r.value as number);
  if (!filled.length) return { score: null, realVal: null, filledCount: 0 };

  let realVal: number | null = null;
  let score: number | null = null;

  if (ind.formula_type === "ratio" || ind.formula_type === "avg") {
    realVal = filled.reduce((a, b) => a + b, 0) / filled.length;
    score = tgtNum ? Math.min((realVal / tgtNum) * 100, 120) : null;
  } else if (ind.formula_type === "akumulasi") {
    realVal = filled.reduce((a, b) => a + b, 0);
    score = tgtNum ? Math.min((realVal / tgtNum) * 100, 120) : null;
  } else if (ind.formula_type === "lower") {
    realVal = filled.reduce((a, b) => a + b, 0) / filled.length;
    score = realVal === 0 ? 120 : tgtNum ? Math.min((tgtNum / realVal) * 100, 120) : null;
  } else if (ind.formula_type === "threshold") {
    const v = filled[filled.length - 1];
    realVal = v; score = 0;
    for (const t of (ind.thresholds || [])) {
      const match = t.op === "=" ? v === t.val : t.op === "<" ? v < t.val : t.op === "<=" ? v <= t.val : t.op === ">" ? v > t.val : v >= t.val;
      if (match) { score = t.score; break; }
    }
  }

  return { score, realVal, filledCount: filled.length };
}

function getGrade(score: number | null, grades: KpiGrade[]) {
  if (score === null) return null;
  const sorted = [...grades].sort((a, b) => b.min_score - a.min_score);
  for (const g of sorted) { if (score >= g.min_score) return g; }
  return null;
}

function scoreBadgeClass(score: number | null) {
  if (score === null) return "bg-muted text-muted-foreground";
  if (score >= 90) return "bg-green-100 text-green-800";
  if (score >= 75) return "bg-blue-100 text-blue-800";
  if (score >= 60) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}

function scoreBadgeLabel(score: number | null) {
  if (score === null) return "Belum diisi";
  if (score >= 90) return `${score.toFixed(1)} — On track`;
  if (score >= 75) return `${score.toFixed(1)} — Baik`;
  if (score >= 60) return `${score.toFixed(1)} — Perlu perhatian`;
  return `${score.toFixed(1)} — Di bawah target`;
}

function formatRupiah(n: number) {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function KPI() {
  const { toast } = useToast();

  // Selection state
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Data state
  const [indicators, setIndicators] = useState<KpiIndicator[]>([]);
  const [realizations, setRealizations] = useState<KpiRealization[]>([]);
  const [grades, setGrades] = useState<KpiGrade[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  // UI state
  const [expandedInd, setExpandedInd] = useState<string | null>(null);

  // ── Fetch helpers ──────────────────────────────────────────────────────────

  useEffect(() => { fetchEmployees(); fetchGrades(); }, []);

  useEffect(() => {
    if (selectedEmployee && selectedYear) { fetchIndicators(); fetchRealizations(); }
  }, [selectedEmployee, selectedYear]);

  const fetchEmployees = async () => {
    const { data } = await supabase.from("profiles").select("id, full_name, position, department, basic_salary").order("full_name");
    if (data) setEmployees(data as Employee[]);
  };

  const fetchGrades = async () => {
    const { data } = await supabase.from("kpi_grade_settings").select("*").order("min_score", { ascending: false });
    if (data && data.length > 0) setGrades(data as KpiGrade[]);
    else setGrades([
      { id: "a", grade: "A", min_score: 90, bonus_percent: 15 },
      { id: "b", grade: "B", min_score: 75, bonus_percent: 10 },
      { id: "c", grade: "C", min_score: 60, bonus_percent: 5 },
      { id: "d", grade: "D", min_score: 0,  bonus_percent: 0  },
    ]);
  };

  const fetchIndicators = useCallback(async () => {
    if (!selectedEmployee) return;
    setLoading(true);
    const { data } = await supabase
      .from("kpi_indicators")
      .select("*")
      .eq("user_id", selectedEmployee)
      .eq("year", selectedYear)
      .order("sort_order");
    setIndicators(
      (data || []).map((d: any) => ({
        ...d,
        thresholds: d.thresholds || [],
        custom_vars: d.custom_vars || [],
        custom_expr: d.custom_expr || "",
      }))
    );
    setLoading(false);
  }, [selectedEmployee, selectedYear]);

  const fetchRealizations = useCallback(async () => {
    if (!selectedEmployee) return;
    const { data } = await supabase
      .from("kpi_realizations")
      .select("*")
      .eq("user_id", selectedEmployee)
      .eq("year", selectedYear);
    setRealizations((data || []).map((d: any) => ({ ...d, custom_values: d.custom_values || {} })));
  }, [selectedEmployee, selectedYear]);

  // ── Indicator CRUD ─────────────────────────────────────────────────────────

  const addIndicator = () => {
    const tempId = "new_" + Date.now();
    setIndicators(prev => [...prev, {
      id: tempId, user_id: selectedEmployee, year: selectedYear,
      name: "", description: "", weight: 0, target: "100", unit: "%",
      formula_type: "ratio", thresholds: [{ op: ">", val: 0, score: 100 }],
      custom_vars: [{ lbl: "Variabel A" }, { lbl: "Variabel B" }],
      custom_expr: "(v0/v1)*100", sort_order: indicators.length,
    }]);
  };

  const removeIndicator = async (id: string) => {
    if (!id.startsWith("new_")) {
      await supabase.from("kpi_indicators").delete().eq("id", id);
    }
    setIndicators(prev => prev.filter(i => i.id !== id));
    toast({ title: "Indicator dihapus" });
  };

  const updateIndicator = (id: string, patch: Partial<KpiIndicator>) => {
    setIndicators(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
  };

  const saveIndicators = async () => {
    if (!selectedEmployee) return;
    const totalWeight = indicators.reduce((s, i) => s + (+i.weight || 0), 0);
    if (Math.abs(totalWeight - 100) > 0.1) {
      toast({ title: "Total bobot harus 100%", description: `Saat ini: ${totalWeight.toFixed(0)}%`, variant: "destructive" });
      return;
    }
    setSaving(true);
    for (const ind of indicators) {
      const payload = {
        user_id: selectedEmployee, year: selectedYear,
        name: ind.name, description: ind.description,
        weight: ind.weight, target: ind.target, unit: ind.unit,
        formula_type: ind.formula_type,
        thresholds: ind.thresholds, custom_vars: ind.custom_vars, custom_expr: ind.custom_expr,
        sort_order: ind.sort_order, updated_at: new Date().toISOString(),
      };
      if (ind.id.startsWith("new_")) {
        const { data } = await supabase.from("kpi_indicators").insert(payload).select().single();
        if (data) setIndicators(prev => prev.map(i => i.id === ind.id ? { ...i, id: data.id } : i));
      } else {
        await supabase.from("kpi_indicators").update(payload).eq("id", ind.id);
      }
    }
    setSaving(false);
    toast({ title: "Indicator berhasil disimpan" });
  };

  // ── Realization helpers ────────────────────────────────────────────────────

  const getRealization = (indId: string, month: number) =>
    realizations.find(r => r.indicator_id === indId && r.month === month);

  const upsertRealization = async (indId: string, month: number, value: number | null, customValues?: Record<string, number>) => {
    const existing = getRealization(indId, month);
    const payload: any = {
      indicator_id: indId, user_id: selectedEmployee,
      month, year: selectedYear,
      value: value ?? null,
      custom_values: customValues ?? {},
      updated_at: new Date().toISOString(),
    };
    if (existing?.id) {
      await supabase.from("kpi_realizations").update(payload).eq("id", existing.id);
      setRealizations(prev => prev.map(r => r.id === existing.id ? { ...r, ...payload } : r));
    } else {
      const { data } = await supabase.from("kpi_realizations").insert(payload).select().single();
      if (data) setRealizations(prev => [...prev, data as KpiRealization]);
    }
  };

  const saveGrades = async () => {
    setSaving(true);
    for (const g of grades) {
      await supabase.from("kpi_grade_settings").update({ min_score: g.min_score, bonus_percent: g.bonus_percent }).eq("id", g.id);
    }
    setSaving(false);
    toast({ title: "Grade setting disimpan" });
  };

  // ── Computed values ────────────────────────────────────────────────────────

  const employee = employees.find(e => e.id === selectedEmployee);
  const totalWeight = indicators.reduce((s, i) => s + (+i.weight || 0), 0);

  const scoreResults = indicators.map(ind => ({ ind, ...computeScore(ind, realizations) }));
  const allHaveScore = scoreResults.length > 0 && scoreResults.every(r => r.score !== null);
  const finalScore = allHaveScore ? scoreResults.reduce((s, r) => s + (r.score! * (r.ind.weight / 100)), 0) : null;
  const finalGrade = getGrade(finalScore, grades);

  const baseSalary = employee?.basic_salary || 0;
  const bonusPercent = finalGrade?.bonus_percent || 0;
  const bonusAmount = baseSalary * (bonusPercent / 100);

  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Target className="w-6 h-6" /> KPI Management
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Setup indicator, input realisasi, dan hitung bonus karyawan</p>
          </div>
        </div>

        {/* Employee + Year selector */}
        <Card>
          <CardContent className="pt-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Karyawan</Label>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih karyawan..." />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map(e => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.full_name} {e.position ? `— ${e.position}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Tahun</Label>
                <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {employee && (
                <div className="flex items-end">
                  <div className="text-sm">
                    <div className="font-medium">{employee.full_name}</div>
                    <div className="text-muted-foreground">{employee.department || employee.position || "—"}</div>
                    <div className="text-muted-foreground">{formatRupiah(employee.basic_salary || 0)} / bulan</div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {!selectedEmployee ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Users className="w-12 h-12 mb-3 opacity-30" />
            <p>Pilih karyawan untuk mulai mengatur KPI</p>
          </div>
        ) : (
          <Tabs defaultValue="setup">
            <TabsList className="mb-4">
              <TabsTrigger value="setup">Setup Indicator</TabsTrigger>
              <TabsTrigger value="input">Input Realisasi</TabsTrigger>
              <TabsTrigger value="progress">Progress & Score</TabsTrigger>
              <TabsTrigger value="payroll">Payroll Output</TabsTrigger>
            </TabsList>

            {/* ─── TAB 1: SETUP ──────────────────────────────────────── */}
            <TabsContent value="setup" className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin w-6 h-6" /></div>
              ) : (
                <>
                  {indicators.length === 0 && (
                    <p className="text-sm text-muted-foreground py-4">Belum ada indicator. Klik "Tambah Indicator" untuk mulai.</p>
                  )}

                  {indicators.map((ind, ix) => {
                    const ft = FORMULA_TYPES.find(f => f.v === ind.formula_type) || FORMULA_TYPES[0];
                    const isExpanded = expandedInd === ind.id;

                    return (
                      <Card key={ind.id}>
                        <CardContent className="pt-4 space-y-3">
                          {/* Header row */}
                          <div className="flex items-start gap-2">
                            <div className="flex-1 space-y-2">
                              <Input
                                value={ind.name}
                                placeholder="Nama indicator KPI"
                                className="font-medium text-base"
                                onChange={e => updateIndicator(ind.id, { name: e.target.value })}
                              />
                              <Textarea
                                value={ind.description}
                                placeholder="Deskripsi (opsional)"
                                className="min-h-[48px] text-sm"
                                onChange={e => updateIndicator(ind.id, { description: e.target.value })}
                              />
                            </div>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" onClick={() => setExpandedInd(isExpanded ? null : ind.id)}>
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </Button>
                              <Button size="sm" variant="ghost" className="text-red-500" onClick={() => removeIndicator(ind.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>

                          {/* Config row */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                              <Label className="text-xs mb-1 block">Bobot %</Label>
                              <Input type="number" value={ind.weight}
                                onChange={e => updateIndicator(ind.id, { weight: +e.target.value || 0 })} />
                            </div>
                            <div>
                              <Label className="text-xs mb-1 block">Target</Label>
                              <Input value={ind.target} placeholder="100"
                                onChange={e => updateIndicator(ind.id, { target: e.target.value })} />
                            </div>
                            <div>
                              <Label className="text-xs mb-1 block">Satuan</Label>
                              <Input value={ind.unit} placeholder="%, Hari, dll"
                                onChange={e => updateIndicator(ind.id, { unit: e.target.value })} />
                            </div>
                            <div>
                              <Label className="text-xs mb-1 block">Tipe Formula</Label>
                              <Select value={ind.formula_type} onValueChange={v => updateIndicator(ind.id, { formula_type: v as any })}>
                                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {FORMULA_TYPES.map(f => <SelectItem key={f.v} value={f.v} className="text-xs">{f.lbl}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="text-xs text-muted-foreground bg-muted rounded px-3 py-2">{ft.hint}</div>

                          {/* Expanded: threshold / custom config */}
                          {isExpanded && ind.formula_type === "threshold" && (
                            <div className="space-y-2 border-t pt-3">
                              <p className="text-xs font-medium text-muted-foreground">Aturan threshold (urutan atas ke bawah, pertama cocok = dipakai):</p>
                              {ind.thresholds.map((t, ti) => (
                                <div key={ti} className="flex items-center gap-2 text-sm">
                                  <span className="text-muted-foreground whitespace-nowrap">Jika nilai</span>
                                  <Select value={t.op} onValueChange={v => {
                                    const thr = [...ind.thresholds]; thr[ti] = { ...thr[ti], op: v as any };
                                    updateIndicator(ind.id, { thresholds: thr });
                                  }}>
                                    <SelectTrigger className="w-16 h-7 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      {["=", "<", "<=", ">", ">="].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                  <Input type="number" value={t.val} className="w-20 h-7 text-xs"
                                    onChange={e => { const thr = [...ind.thresholds]; thr[ti] = { ...thr[ti], val: +e.target.value }; updateIndicator(ind.id, { thresholds: thr }); }} />
                                  <span className="text-muted-foreground">→ Score</span>
                                  <Input type="number" value={t.score} className="w-16 h-7 text-xs"
                                    onChange={e => { const thr = [...ind.thresholds]; thr[ti] = { ...thr[ti], score: +e.target.value }; updateIndicator(ind.id, { thresholds: thr }); }} />
                                  <Button size="sm" variant="ghost" className="h-7 text-red-500" onClick={() => {
                                    updateIndicator(ind.id, { thresholds: ind.thresholds.filter((_, i) => i !== ti) });
                                  }}><Trash2 className="w-3 h-3" /></Button>
                                </div>
                              ))}
                              <Button size="sm" variant="outline" className="text-xs" onClick={() =>
                                updateIndicator(ind.id, { thresholds: [...ind.thresholds, { op: "=", val: 0, score: 100 }] })}>
                                + Tambah rule
                              </Button>
                            </div>
                          )}

                          {isExpanded && ind.formula_type === "custom" && (
                            <div className="space-y-3 border-t pt-3">
                              <p className="text-xs font-medium text-muted-foreground">Variabel input (diisi tiap bulan):</p>
                              {ind.custom_vars.map((cv, vi) => (
                                <div key={vi} className="flex items-center gap-2">
                                  <Input value={cv.lbl} className="w-40 h-7 text-xs" placeholder="Label variabel"
                                    onChange={e => {
                                      const vars = [...ind.custom_vars]; vars[vi] = { lbl: e.target.value };
                                      updateIndicator(ind.id, { custom_vars: vars });
                                    }} />
                                  <span className="text-xs text-muted-foreground">= v{vi}</span>
                                  <Button size="sm" variant="ghost" className="h-7 text-red-500"
                                    onClick={() => updateIndicator(ind.id, { custom_vars: ind.custom_vars.filter((_, i) => i !== vi) })}>
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              ))}
                              <Button size="sm" variant="outline" className="text-xs"
                                onClick={() => updateIndicator(ind.id, { custom_vars: [...ind.custom_vars, { lbl: `Variabel ${ind.custom_vars.length + 1}` }] })}>
                                + Tambah variabel
                              </Button>
                              <div>
                                <Label className="text-xs mb-1 block">Formula (gunakan v0, v1, v2, ...)</Label>
                                <Input value={ind.custom_expr} placeholder="Contoh: (v0 / v1) * 100"
                                  onChange={e => updateIndicator(ind.id, { custom_expr: e.target.value })} />
                                <p className="text-xs text-muted-foreground mt-1">Hasil formula dibandingkan ke target → score = (hasil/target)×100</p>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}

                  {/* Total bobot */}
                  <p className={`text-xs text-right font-medium ${Math.abs(totalWeight - 100) < 0.1 ? "text-green-600" : "text-red-500"}`}>
                    Total bobot: {totalWeight.toFixed(0)}% {Math.abs(totalWeight - 100) < 0.1 ? "✓" : "— harus = 100%"}
                  </p>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={addIndicator}><Plus className="w-4 h-4 mr-1" /> Tambah Indicator</Button>
                    <Button onClick={saveIndicators} disabled={saving}>
                      {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                      Simpan Semua
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>

            {/* ─── TAB 2: INPUT REALISASI ────────────────────────────── */}
            <TabsContent value="input" className="space-y-4">
              {indicators.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Belum ada indicator. Setup dulu di tab pertama.</p>
              ) : indicators.map(ind => {
                const { score, realVal, filledCount } = computeScore(ind, realizations);
                const barPct = score !== null ? Math.min(score, 100) : 0;
                const barColor = score === null ? "bg-muted" : score >= 90 ? "bg-green-500" : score >= 75 ? "bg-blue-500" : score >= 60 ? "bg-amber-500" : "bg-red-500";

                return (
                  <Card key={ind.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base">{ind.name || "(tanpa nama)"}</CardTitle>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Target: <strong>{ind.target} {ind.unit}</strong> · Bobot {ind.weight}% · {FORMULA_TYPES.find(f => f.v === ind.formula_type)?.lbl}
                          </p>
                        </div>
                        <Badge className={`text-xs ${scoreBadgeClass(score)}`}>{scoreBadgeLabel(score)}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {ind.formula_type === "custom" ? (
                        <div className="space-y-3">
                          {MONTHS.map((m, mi) => {
                            const r = getRealization(ind.id, mi);
                            return (
                              <div key={mi} className="bg-muted/30 rounded-lg p-3">
                                <p className="text-xs font-medium mb-2">{m}</p>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                  {ind.custom_vars.map((cv, vi) => {
                                    const val = r?.custom_values?.[`v${vi}`];
                                    return (
                                      <div key={vi}>
                                        <Label className="text-xs mb-1 block">{cv.lbl}</Label>
                                        <Input
                                          type="number"
                                          className={`h-8 text-sm ${val !== undefined ? "border-blue-400" : ""}`}
                                          defaultValue={val ?? ""}
                                          onBlur={async e => {
                                            const v = e.target.value === "" ? undefined : +e.target.value;
                                            const existing = getRealization(ind.id, mi);
                                            const cv = { ...(existing?.custom_values || {}) };
                                            if (v === undefined) delete cv[`v${vi}`]; else cv[`v${vi}`] = v;
                                            await upsertRealization(ind.id, mi, null, cv);
                                          }}
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                          {MONTHS.map((m, mi) => {
                            const r = getRealization(ind.id, mi);
                            return (
                              <div key={mi} className="bg-muted/30 rounded p-2">
                                <p className="text-xs text-muted-foreground mb-1">{m}</p>
                                <Input
                                  type="number"
                                  className={`h-8 text-sm text-right ${r?.value !== null && r?.value !== undefined ? "border-blue-400" : ""}`}
                                  defaultValue={r?.value ?? ""}
                                  placeholder="—"
                                  onBlur={async e => {
                                    const v = e.target.value === "" ? null : +e.target.value;
                                    await upsertRealization(ind.id, mi, v);
                                  }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Summary bar */}
                      <div className="border-t pt-3 space-y-2">
                        <div className="grid grid-cols-4 gap-2">
                          {[
                            { lbl: "Bulan terisi", val: `${filledCount}/12` },
                            { lbl: "Realisasi", val: realVal !== null ? realVal.toFixed(1) : "—" },
                            { lbl: "Target", val: `${ind.target} ${ind.unit}` },
                            { lbl: "Score", val: score !== null ? score.toFixed(1) : "—" },
                          ].map(item => (
                            <div key={item.lbl} className="bg-muted/40 rounded p-2">
                              <p className="text-xs text-muted-foreground">{item.lbl}</p>
                              <p className="text-base font-medium">{item.val}</p>
                            </div>
                          ))}
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${barPct}%` }} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>

            {/* ─── TAB 3: PROGRESS & SCORE ───────────────────────────── */}
            <TabsContent value="progress" className="space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Score Akhir</p>
                    <p className={`text-3xl font-semibold mt-1 ${finalScore === null ? "text-muted-foreground" : finalScore >= 90 ? "text-green-600" : finalScore >= 75 ? "text-blue-600" : finalScore >= 60 ? "text-amber-600" : "text-red-600"}`}>
                      {finalScore !== null ? finalScore.toFixed(1) : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{allHaveScore ? "Semua indicator lengkap" : "Ada yang belum terisi"}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Grade Proyeksi</p>
                    <p className={`text-3xl font-semibold mt-1 ${finalScore === null ? "text-muted-foreground" : finalScore >= 90 ? "text-green-600" : finalScore >= 75 ? "text-blue-600" : finalScore >= 60 ? "text-amber-600" : "text-red-600"}`}>
                      {finalGrade?.grade || "—"}
                    </p>
                    {finalGrade && <p className="text-xs text-muted-foreground mt-0.5">Bonus {finalGrade.bonus_percent}%</p>}
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Total Indicator</p>
                    <p className="text-3xl font-semibold mt-1">{indicators.length}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{scoreResults.filter(r => r.filledCount > 0).length} sudah ada data</p>
                  </CardContent>
                </Card>
              </div>

              {/* Per indicator detail */}
              {scoreResults.map(({ ind, score, realVal, filledCount }) => {
                const barPct = score !== null ? Math.min(score, 100) : 0;
                const barColor = score === null ? "bg-muted" : score >= 90 ? "bg-green-500" : score >= 75 ? "bg-blue-500" : score >= 60 ? "bg-amber-500" : "bg-red-500";
                const reals = realizations.filter(r => r.indicator_id === ind.id);

                return (
                  <Card key={ind.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-sm">{ind.name || "(tanpa nama)"}</CardTitle>
                          <p className="text-xs text-muted-foreground">Bobot {ind.weight}% · {filledCount}/12 bulan</p>
                        </div>
                        <div className="text-right">
                          <Badge className={`text-xs ${scoreBadgeClass(score)}`}>{scoreBadgeLabel(score)}</Badge>
                          {score !== null && (
                            <p className="text-xs text-muted-foreground mt-1">Kontribusi: {(score * (ind.weight / 100)).toFixed(2)} poin</p>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-3">
                        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${barPct}%` }} />
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Bulan</TableHead>
                            <TableHead className="text-xs text-right">Realisasi</TableHead>
                            <TableHead className="text-xs text-right">Target</TableHead>
                            <TableHead className="text-xs text-right">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {MONTHS.map((m, mi) => {
                            const r = reals.find(x => x.month === mi);
                            const val = r?.value ?? null;
                            const tgtNum = parseFloat(ind.target) || 0;
                            const ok = val === null ? null : ind.formula_type === "lower" ? val <= tgtNum : val >= tgtNum;
                            return (
                              <TableRow key={mi}>
                                <TableCell className="text-xs py-1.5">{m}</TableCell>
                                <TableCell className="text-xs text-right py-1.5">{val !== null ? val.toLocaleString("id-ID") : "—"}</TableCell>
                                <TableCell className="text-xs text-right py-1.5">{ind.target} {ind.unit}</TableCell>
                                <TableCell className="text-xs text-right py-1.5">
                                  {ok === null ? <span className="text-muted-foreground">—</span> : ok ? <span className="text-green-600">✓</span> : <span className="text-red-500">✗</span>}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          <TableRow className="bg-muted/30 font-medium">
                            <TableCell className="text-xs py-1.5">Hasil</TableCell>
                            <TableCell className="text-xs text-right py-1.5">{realVal !== null ? `${realVal.toFixed(1)} ${ind.unit}` : "—"}</TableCell>
                            <TableCell className="text-xs text-right py-1.5">{ind.target} {ind.unit}</TableCell>
                            <TableCell className="text-xs text-right py-1.5">
                              <Badge className={`text-xs ${scoreBadgeClass(score)}`}>{score !== null ? score.toFixed(1) : "—"}</Badge>
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>

            {/* ─── TAB 4: PAYROLL OUTPUT ─────────────────────────────── */}
            <TabsContent value="payroll" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Grade mapping */}
                <Card>
                  <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Award className="w-4 h-4" /> Grade & Bonus Mapping</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {grades.map((g, gi) => (
                      <div key={g.id} className="flex items-center justify-between gap-3 py-2 border-b last:border-0">
                        <div className="flex items-center gap-2">
                          <Badge className={`${g.min_score >= 90 ? "bg-green-100 text-green-800" : g.min_score >= 75 ? "bg-blue-100 text-blue-800" : g.min_score >= 60 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}`}>
                            Grade {g.grade}
                          </Badge>
                          <span className="text-xs text-muted-foreground">min score</span>
                          <Input type="number" value={g.min_score} className="w-16 h-7 text-xs"
                            onChange={e => setGrades(prev => prev.map((x, i) => i === gi ? { ...x, min_score: +e.target.value } : x))} />
                        </div>
                        <div className="flex items-center gap-2">
                          <Input type="number" value={g.bonus_percent} className="w-16 h-7 text-xs"
                            onChange={e => setGrades(prev => prev.map((x, i) => i === gi ? { ...x, bonus_percent: +e.target.value } : x))} />
                          <span className="text-xs text-muted-foreground">% bonus</span>
                        </div>
                      </div>
                    ))}
                    <Button size="sm" variant="outline" className="w-full mt-2" onClick={saveGrades} disabled={saving}>
                      {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
                      Simpan Grade
                    </Button>
                  </CardContent>
                </Card>

                {/* Payroll slip */}
                <Card>
                  <CardHeader><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="w-4 h-4" /> Slip Payroll KPI</CardTitle></CardHeader>
                  <CardContent className="space-y-1">
                    {employee && (
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm">
                          {employee.full_name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{employee.full_name}</p>
                          <p className="text-xs text-muted-foreground">{employee.position || employee.department || "—"} · Tahun {selectedYear}</p>
                        </div>
                      </div>
                    )}
                    {[
                      { lbl: "KPI Score akhir tahun", val: finalScore !== null ? finalScore.toFixed(1) : "Belum semua indicator lengkap" },
                      { lbl: "Grade", val: finalGrade?.grade || "—" },
                      { lbl: "Gaji pokok", val: formatRupiah(baseSalary) },
                      { lbl: `Bonus KPI (${bonusPercent}%)`, val: formatRupiah(bonusAmount), green: true },
                    ].map(item => (
                      <div key={item.lbl} className="flex justify-between items-center py-2 border-b last:border-0">
                        <span className="text-sm text-muted-foreground">{item.lbl}</span>
                        <span className={`text-sm font-medium ${item.green ? "text-green-600" : ""}`}>{item.val}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center pt-3 border-t mt-2">
                      <span className="text-sm font-semibold">Total take-home</span>
                      <span className="text-xl font-semibold text-green-600">{formatRupiah(baseSalary + bonusAmount)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* All employees summary */}
              <Card>
                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Rekap KPI {selectedYear}</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Karyawan</TableHead>
                        <TableHead className="text-right">Score</TableHead>
                        <TableHead className="text-right">Grade</TableHead>
                        <TableHead className="text-right">Bonus %</TableHead>
                        <TableHead className="text-right">Bonus (Rp)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {finalScore !== null && employee ? (
                        <TableRow>
                          <TableCell className="font-medium">{employee.full_name}</TableCell>
                          <TableCell className="text-right"><Badge className={`text-xs ${scoreBadgeClass(finalScore)}`}>{finalScore.toFixed(1)}</Badge></TableCell>
                          <TableCell className="text-right">{finalGrade?.grade || "—"}</TableCell>
                          <TableCell className="text-right">{bonusPercent}%</TableCell>
                          <TableCell className="text-right text-green-600 font-medium">{formatRupiah(bonusAmount)}</TableCell>
                        </TableRow>
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">
                            Lengkapi semua realisasi untuk melihat hasil KPI
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
