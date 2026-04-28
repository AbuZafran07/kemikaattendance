import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Target, TrendingUp, Award, Loader2 } from "lucide-react";
import logo from "@/assets/logo.png";

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

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];

const FORMULA_LABELS: Record<string, string> = {
  ratio: "Rasio", akumulasi: "Akumulasi", avg: "Rata-rata",
  lower: "Lower better", threshold: "Threshold", custom: "Kustom",
};

// ─── Score Engine ─────────────────────────────────────────────────────────────

function computeScore(ind: KpiIndicator, realizations: KpiRealization[]) {
  const tgtNum = parseFloat(ind.target) || 0;
  const reals = realizations.filter(r => r.indicator_id === ind.id);

  if (ind.formula_type === "custom") {
    const cvars = ind.custom_vars || [];
    let lastMonth: KpiRealization | null = null;
    for (let mi = 11; mi >= 0; mi--) {
      const r = reals.find(x => x.month === mi);
      if (r && cvars.every((_, vi) => r.custom_values?.[`v${vi}`] !== undefined)) { lastMonth = r; break; }
    }
    if (!lastMonth) return { score: null, realVal: null, filledCount: reals.length };
    try {
      let expr = ind.custom_expr || "0";
      cvars.forEach((_, vi) => { expr = expr.replaceAll(`v${vi}`, String(lastMonth!.custom_values?.[`v${vi}`] ?? 0)); });
      // eslint-disable-next-line no-new-func
      const realVal = Function('"use strict";return (' + expr + ')')() as number;
      return { score: tgtNum ? Math.min((realVal / tgtNum) * 100, 120) : null, realVal, filledCount: reals.length };
    } catch { return { score: null, realVal: null, filledCount: reals.length }; }
  }

  const filled = reals.filter(r => r.value !== null && r.value !== undefined).map(r => r.value as number);
  if (!filled.length) return { score: null, realVal: null, filledCount: 0 };

  let realVal: number | null = null, score: number | null = null;
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
    const v = filled[filled.length - 1]; realVal = v; score = 0;
    for (const t of (ind.thresholds || [])) {
      const m = t.op === "=" ? v === t.val : t.op === "<" ? v < t.val : t.op === "<=" ? v <= t.val : t.op === ">" ? v > t.val : v >= t.val;
      if (m) { score = t.score; break; }
    }
  }
  return { score, realVal, filledCount: filled.length };
}

function scoreBadgeClass(score: number | null) {
  if (score === null) return "bg-muted text-muted-foreground";
  if (score >= 90) return "bg-green-100 text-green-800";
  if (score >= 75) return "bg-blue-100 text-blue-800";
  if (score >= 60) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EmployeeKPI() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [indicators, setIndicators] = useState<KpiIndicator[]>([]);
  const [realizations, setRealizations] = useState<KpiRealization[]>([]);
  const [grades, setGrades] = useState<KpiGrade[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 1, currentYear];

  const fetchData = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const [indRes, realRes, gradeRes] = await Promise.all([
      supabase.from("kpi_indicators").select("*").eq("user_id", profile.id).eq("year", selectedYear).order("sort_order"),
      supabase.from("kpi_realizations").select("*").eq("user_id", profile.id).eq("year", selectedYear),
      supabase.from("kpi_grade_settings").select("*").order("min_score", { ascending: false }),
    ]);
    setIndicators((indRes.data || []).map((d: any) => ({ ...d, thresholds: d.thresholds || [], custom_vars: d.custom_vars || [], custom_expr: d.custom_expr || "" })));
    setRealizations((realRes.data || []).map((d: any) => ({ ...d, custom_values: d.custom_values || {} })));
    if (gradeRes.data?.length) setGrades(gradeRes.data as KpiGrade[]);
    else setGrades([
      { id: "a", grade: "A", min_score: 90, bonus_percent: 15 },
      { id: "b", grade: "B", min_score: 75, bonus_percent: 10 },
      { id: "c", grade: "C", min_score: 60, bonus_percent: 5 },
      { id: "d", grade: "D", min_score: 0, bonus_percent: 0 },
    ]);
    setLoading(false);
  }, [profile?.id, selectedYear]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getRealization = (indId: string, month: number) =>
    realizations.find(r => r.indicator_id === indId && r.month === month);

  const upsertRealization = async (indId: string, month: number, value: number | null, customValues?: Record<string, number>) => {
    const existing = getRealization(indId, month);
    const payload: any = {
      indicator_id: indId, user_id: profile?.id,
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

  // Computed
  const scoreResults = indicators.map(ind => ({ ind, ...computeScore(ind, realizations) }));
  const allHaveScore = scoreResults.length > 0 && scoreResults.every(r => r.score !== null);
  const finalScore = allHaveScore ? scoreResults.reduce((s, r) => s + (r.score! * (r.ind.weight / 100)), 0) : null;
  const finalGrade = finalScore !== null ? [...grades].sort((a, b) => b.min_score - a.min_score).find(g => finalScore >= g.min_score) || null : null;
  const baseSalary = profile?.basic_salary || 0;
  const bonusAmount = baseSalary * ((finalGrade?.bonus_percent || 0) / 100);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <img src={logo} alt="logo" className="h-7 object-contain" />
        <div>
          <h1 className="text-base font-semibold leading-tight">KPI Saya</h1>
          <p className="text-xs text-muted-foreground">Key Performance Indicator</p>
        </div>
        <div className="ml-auto">
          <select
            className="text-xs border rounded px-2 py-1"
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
          >
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto pb-24">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin w-6 h-6 text-muted-foreground" /></div>
        ) : indicators.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Target className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">Belum ada KPI yang ditetapkan</p>
            <p className="text-xs mt-1">Hubungi HR/Admin untuk setup indicator KPI kamu</p>
          </div>
        ) : (
          <Tabs defaultValue="realisasi">
            <TabsList className="w-full mb-4">
              <TabsTrigger value="realisasi" className="flex-1">Input Realisasi</TabsTrigger>
              <TabsTrigger value="progress" className="flex-1">Progress</TabsTrigger>
              <TabsTrigger value="score" className="flex-1">Score</TabsTrigger>
            </TabsList>

            {/* ─── TAB: INPUT REALISASI ──────────────────────────────── */}
            <TabsContent value="realisasi" className="space-y-4">
              <p className="text-xs text-muted-foreground">Isi nilai realisasi tiap bulan untuk setiap indicator KPI kamu.</p>
              {indicators.map(ind => {
                const { score, filledCount } = computeScore(ind, realizations);
                const barPct = score !== null ? Math.min(score, 100) : 0;
                const barColor = score === null ? "bg-muted" : score >= 90 ? "bg-green-500" : score >= 75 ? "bg-blue-500" : score >= 60 ? "bg-amber-500" : "bg-red-500";

                return (
                  <Card key={ind.id}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-sm">{ind.name}</CardTitle>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Target: <strong>{ind.target} {ind.unit}</strong> · Bobot {ind.weight}% · {FORMULA_LABELS[ind.formula_type]}
                          </p>
                        </div>
                        <Badge className={`text-xs shrink-0 ${scoreBadgeClass(score)}`}>
                          {score !== null ? score.toFixed(1) : "—"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {ind.formula_type === "custom" ? (
                        <div className="space-y-2">
                          {MONTHS.map((m, mi) => {
                            const r = getRealization(ind.id, mi);
                            return (
                              <div key={mi} className="bg-muted/30 rounded-lg p-2.5">
                                <p className="text-xs font-medium mb-1.5">{m}</p>
                                <div className="grid grid-cols-2 gap-2">
                                  {ind.custom_vars.map((cv, vi) => {
                                    const val = r?.custom_values?.[`v${vi}`];
                                    return (
                                      <div key={vi}>
                                        <Label className="text-xs mb-0.5 block">{cv.lbl}</Label>
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
                        <div className="grid grid-cols-3 gap-2">
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

                      <div className="border-t pt-2 space-y-1">
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${barPct}%` }} />
                        </div>
                        <p className="text-xs text-muted-foreground text-right">{filledCount}/12 bulan terisi</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>

            {/* ─── TAB: PROGRESS ─────────────────────────────────────── */}
            <TabsContent value="progress" className="space-y-3">
              {scoreResults.map(({ ind, score, realVal, filledCount }) => {
                const barPct = score !== null ? Math.min(score, 100) : 0;
                const barColor = score === null ? "bg-muted" : score >= 90 ? "bg-green-500" : score >= 75 ? "bg-blue-500" : score >= 60 ? "bg-amber-500" : "bg-red-500";
                const reals = realizations.filter(r => r.indicator_id === ind.id);

                return (
                  <Card key={ind.id}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-sm">{ind.name}</CardTitle>
                          <p className="text-xs text-muted-foreground">Bobot {ind.weight}% · {filledCount}/12 bulan</p>
                        </div>
                        <div className="text-right">
                          <Badge className={`text-xs ${scoreBadgeClass(score)}`}>
                            {score !== null ? score.toFixed(1) : "—"}
                          </Badge>
                          {score !== null && (
                            <p className="text-xs text-muted-foreground mt-0.5">{(score * (ind.weight / 100)).toFixed(2)} poin</p>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-3">
                        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${barPct}%` }} />
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs p-1.5">Bulan</TableHead>
                            <TableHead className="text-xs text-right p-1.5">Realisasi</TableHead>
                            <TableHead className="text-xs text-right p-1.5">Target</TableHead>
                            <TableHead className="text-xs text-right p-1.5"></TableHead>
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
                                <TableCell className="text-xs p-1.5">{m}</TableCell>
                                <TableCell className="text-xs text-right p-1.5">{val !== null ? val.toLocaleString("id-ID") : "—"}</TableCell>
                                <TableCell className="text-xs text-right p-1.5">{ind.target} {ind.unit}</TableCell>
                                <TableCell className="text-xs text-right p-1.5">
                                  {ok === null ? "—" : ok ? <span className="text-green-600">✓</span> : <span className="text-red-500">✗</span>}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>

            {/* ─── TAB: SCORE ────────────────────────────────────────── */}
            <TabsContent value="score" className="space-y-3">
              {/* Score summary */}
              <div className="grid grid-cols-2 gap-3">
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="w-4 h-4 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Score Akhir</p>
                    </div>
                    <p className={`text-3xl font-bold ${finalScore === null ? "text-muted-foreground" : finalScore >= 90 ? "text-green-600" : finalScore >= 75 ? "text-blue-600" : finalScore >= 60 ? "text-amber-600" : "text-red-600"}`}>
                      {finalScore !== null ? finalScore.toFixed(1) : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{allHaveScore ? "Semua lengkap" : "Belum semua terisi"}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Award className="w-4 h-4 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Grade</p>
                    </div>
                    <p className={`text-3xl font-bold ${finalGrade?.grade === "A" ? "text-green-600" : finalGrade?.grade === "B" ? "text-blue-600" : finalGrade?.grade === "C" ? "text-amber-600" : "text-muted-foreground"}`}>
                      {finalGrade?.grade || "—"}
                    </p>
                    {finalGrade && <p className="text-xs text-muted-foreground mt-0.5">Bonus {finalGrade.bonus_percent}%</p>}
                  </CardContent>
                </Card>
              </div>

              {/* Per indicator scores */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Detail Per Indicator</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {scoreResults.map(({ ind, score }) => (
                    <div key={ind.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="text-sm font-medium">{ind.name}</p>
                        <p className="text-xs text-muted-foreground">Bobot {ind.weight}%</p>
                      </div>
                      <div className="text-right">
                        <Badge className={`text-xs ${scoreBadgeClass(score)}`}>{score !== null ? score.toFixed(1) : "—"}</Badge>
                        {score !== null && <p className="text-xs text-muted-foreground">{(score * (ind.weight / 100)).toFixed(2)} poin</p>}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Bonus info */}
              {finalScore !== null && (
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="pt-4 space-y-2">
                    <p className="text-sm font-semibold text-green-800">Estimasi Bonus KPI {selectedYear}</p>
                    {[
                      { lbl: "Gaji pokok", val: "Rp " + baseSalary.toLocaleString("id-ID") },
                      { lbl: `Bonus KPI (${finalGrade?.bonus_percent || 0}%)`, val: "Rp " + Math.round(bonusAmount).toLocaleString("id-ID") },
                      { lbl: "Total", val: "Rp " + Math.round(baseSalary + bonusAmount).toLocaleString("id-ID"), bold: true },
                    ].map(item => (
                      <div key={item.lbl} className="flex justify-between text-sm">
                        <span className="text-green-700">{item.lbl}</span>
                        <span className={`text-green-800 ${item.bold ? "font-bold" : "font-medium"}`}>{item.val}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Grade info table */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Tabel Grade & Bonus</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Grade</TableHead>
                        <TableHead className="text-xs">Min Score</TableHead>
                        <TableHead className="text-xs text-right">Bonus</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {grades.map(g => (
                        <TableRow key={g.id} className={finalGrade?.grade === g.grade ? "bg-muted/50" : ""}>
                          <TableCell className="text-xs font-medium">{g.grade}</TableCell>
                          <TableCell className="text-xs">≥ {g.min_score}</TableCell>
                          <TableCell className="text-xs text-right">{g.bonus_percent}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
