/**
 * Indonesian Payroll Calculation Engine
 * Based on PPh 21 regulations (UU HPP 2022 + PP 58/2023 TER)
 */

// PTKP values (Penghasilan Tidak Kena Pajak) - 2024
export const PTKP_VALUES: Record<string, number> = {
  "TK/0": 54000000,
  "TK/1": 58500000,
  "TK/2": 63000000,
  "TK/3": 67500000,
  "K/0": 58500000,
  "K/1": 63000000,
  "K/2": 67500000,
  "K/3": 72000000,
  "K/I/0": 112500000,
  "K/I/1": 117000000,
  "K/I/2": 121500000,
  "K/I/3": 126000000,
};

export const PTKP_OPTIONS = Object.keys(PTKP_VALUES);

// Default BPJS rates (employee portion) — can be overridden via bpjs_config
export const BPJS_KESEHATAN_RATE = 0.01;      // 1% employee
export const BPJS_KETENAGAKERJAAN_RATE = 0.02; // JHT 2% employee
export const BPJS_JP_RATE = 0.01;              // JP 1% employee

// Default BPJS rates (employer portion)
export const BPJS_KES_EMPLOYER_RATE = 0.04;    // 4% employer
export const BPJS_JHT_EMPLOYER_RATE = 0.037;   // 3.7% employer
export const BPJS_JP_EMPLOYER_RATE = 0.02;     // 2% employer
export const BPJS_JKK_EMPLOYER_RATE = 0.0024;  // JKK 0.24% employer (risiko sangat rendah)
export const BPJS_JKM_EMPLOYER_RATE = 0.003;   // JKM 0.3% employer

// PPh 21 progressive tax brackets (UU HPP)
const TAX_BRACKETS = [
  { limit: 60000000, rate: 0.05 },
  { limit: 250000000, rate: 0.15 },
  { limit: 500000000, rate: 0.25 },
  { limit: 5000000000, rate: 0.30 },
  { limit: Infinity, rate: 0.35 },
];

// Default BPJS salary caps
const BPJS_KES_MAX_SALARY = 12000000;
const BPJS_JP_MAX_SALARY = 10547400;

// Dynamic BPJS config interface (rates stored as percentages in DB)
export interface BPJSRatesConfig {
  kes_employee_rate: number;
  kes_employer_rate: number;
  kes_max_salary: number;
  jht_employee_rate: number;
  jht_employer_rate: number;
  jp_employee_rate: number;
  jp_employer_rate: number;
  jp_max_salary: number;
  jkk_employer_rate: number;
  jkm_employer_rate: number;
}

// Biaya Jabatan (5% of bruto, max 6,000,000/year or 500,000/month)
const BIAYA_JABATAN_RATE = 0.05;
const BIAYA_JABATAN_MAX_YEARLY = 6000000;

export function calculatePPh21Annual(pkp: number): number {
  if (pkp <= 0) return 0;
  let remainingPkp = pkp;
  let totalTax = 0;
  let prevLimit = 0;
  for (const bracket of TAX_BRACKETS) {
    const taxableInBracket = Math.min(remainingPkp, bracket.limit - prevLimit);
    if (taxableInBracket <= 0) break;
    totalTax += taxableInBracket * bracket.rate;
    remainingPkp -= taxableInBracket;
    prevLimit = bracket.limit;
  }
  return Math.round(totalTax);
}

export function calculatePPh21Monthly(pkp: number): number {
  return Math.round(calculatePPh21Annual(pkp) / 12);
}

// ===== TER-based PPh21 Calculation =====

export interface TERRate {
  bruto_min: number;
  bruto_max: number;
  tarif_efektif: number; // in percent
}

/**
 * Find applicable TER rate for a given bruto amount
 */
export function findTERRate(brutoMonthly: number, terRates: TERRate[]): TERRate | null {
  return terRates.find(
    r => brutoMonthly >= r.bruto_min && brutoMonthly <= r.bruto_max
  ) || null;
}

/**
 * Calculate PPh21 using TER method (Jan-Nov)
 * No rounding — keeps decimal precision to match Excel
 */
export function calculatePPh21TER(brutoMonthly: number, terRates: TERRate[]): { tax: number; rate: number; mode: "TER" } {
  const rateRow = findTERRate(brutoMonthly, terRates);
  if (!rateRow) return { tax: 0, rate: 0, mode: "TER" };
  const tax = brutoMonthly * (rateRow.tarif_efektif / 100);
  return { tax, rate: rateRow.tarif_efektif, mode: "TER" };
}

/**
 * Calculate PPh21 December reconciliation using Indonesian tax regulation:
 * 1. Penghasilan Bruto Setahun = sum of 12 months bruto
 * 2. Pengurang = Biaya Jabatan (5%, max 6jt) + Iuran JHT Employee + Iuran JP Employee
 * 3. Penghasilan Netto = Bruto - Pengurang
 * 4. PKP = Netto - PTKP (no rounding)
 * 5. PPh21 Terutang = progressive tax on PKP (rounded)
 * 6. PPh21 Desember = Terutang - PPh21 Jan-Nov
 */
export function calculatePPh21Reconciliation(
  yearlyBruto: number,
  yearlyBpjsKtEmployee: number, // Sum of 12 months JHT + JP employee
  ptkpValue: number,
  totalPphJanNov: number
): { tax: number; yearlyTax: number; adjustment: number; mode: "REKONSILIASI"; biayaJabatan: number; yearlyNetto: number; pkp: number } {
  // Biaya Jabatan: 5% of bruto, max 6,000,000/year
  const biayaJabatan = Math.min(yearlyBruto * BIAYA_JABATAN_RATE, BIAYA_JABATAN_MAX_YEARLY);

  // Pengurang = Biaya Jabatan + JHT Employee (2%) + JP Employee (1%)
  const totalPengurang = biayaJabatan + yearlyBpjsKtEmployee;

  // Netto Setahun
  const yearlyNetto = yearlyBruto - totalPengurang;

  // PKP — no rounding, exact value like Excel
  const pkp = Math.max(0, yearlyNetto - ptkpValue);

  // Progressive tax on exact PKP, Math.round on final result
  const yearlyTax = calculatePPh21Annual(pkp);

  // December adjustment (can be negative = refund)
  const adjustment = yearlyTax - totalPphJanNov;

  return {
    tax: adjustment,
    yearlyTax,
    adjustment,
    mode: "REKONSILIASI",
    biayaJabatan,
    yearlyNetto,
    pkp,
  };
}

// ===== Existing Payroll Calculation =====

export interface PayrollInput {
  basicSalary: number;
  allowance: number;
  overtimeTotal: number;
  ptkpStatus: string;
  overtimeHours: number;
  loanDeduction?: number;
  otherDeduction?: number;
  deductionNotes?: string;
  // TER support
  month?: number; // 1-12
  terRates?: TERRate[]; // TER rates for this PTKP category
  totalPphJanNov?: number; // Sum of PPh21 paid Jan-Nov (for Dec reconciliation)
  // BPJS Kesehatan opt-out
  bpjsKesehatanEnabled?: boolean; // default true
  // December reconciliation — actual yearly data from previous months
  prevMonthsBruto?: number;   // Sum of Jan-Nov bruto_income
  prevMonthsBpjsKt?: number;  // Sum of Jan-Nov bpjs_ketenagakerjaan (JHT+JP employee)
  // Dynamic BPJS config
  bpjsConfig?: BPJSRatesConfig;
  // Dynamic PTKP values
  ptkpConfig?: Record<string, number>;
}

export interface PayrollResult {
  basic_salary: number;
  allowance: number;
  overtime_total: number;
  overtime_hours: number;
  bruto_income: number;
  bpjs_kesehatan: number;
  bpjs_ketenagakerjaan: number;
  bpjs_kes_employer: number;
  bpjs_jht_employer: number;
  bpjs_jp_employer: number;
  bpjs_jkk_employer: number;
  bpjs_jkm_employer: number;
  netto_income: number;
  ptkp_status: string;
  ptkp_value: number;
  pkp: number;
  pph21_monthly: number;
  take_home_pay: number;
  loan_deduction: number;
  other_deduction: number;
  deduction_notes: string;
  // TER fields
  pph21_mode: string;
  pph21_ter_rate: number;
}

export function calculatePayroll(input: PayrollInput): PayrollResult {
  const {
    basicSalary, allowance, overtimeTotal, ptkpStatus, overtimeHours,
    loanDeduction = 0, otherDeduction = 0, deductionNotes = "",
    month, terRates, totalPphJanNov = 0,
    bpjsKesehatanEnabled = true,
    prevMonthsBruto = 0, prevMonthsBpjsKt = 0,
    ptkpConfig,
    bpjsConfig,
  } = input;

  // Use dynamic config or fall back to hardcoded defaults
  const kesEmployeeRate = bpjsConfig ? bpjsConfig.kes_employee_rate / 100 : BPJS_KESEHATAN_RATE;
  const kesEmployerRate = bpjsConfig ? bpjsConfig.kes_employer_rate / 100 : BPJS_KES_EMPLOYER_RATE;
  const kesMaxSalary = bpjsConfig ? bpjsConfig.kes_max_salary : BPJS_KES_MAX_SALARY;
  const jhtEmployeeRate = bpjsConfig ? bpjsConfig.jht_employee_rate / 100 : BPJS_KETENAGAKERJAAN_RATE;
  const jhtEmployerRate = bpjsConfig ? bpjsConfig.jht_employer_rate / 100 : BPJS_JHT_EMPLOYER_RATE;
  const jpEmployeeRate = bpjsConfig ? bpjsConfig.jp_employee_rate / 100 : BPJS_JP_RATE;
  const jpEmployerRate = bpjsConfig ? bpjsConfig.jp_employer_rate / 100 : BPJS_JP_EMPLOYER_RATE;
  const jpMaxSalary = bpjsConfig ? bpjsConfig.jp_max_salary : BPJS_JP_MAX_SALARY;
  const jkkEmployerRate = bpjsConfig ? bpjsConfig.jkk_employer_rate / 100 : BPJS_JKK_EMPLOYER_RATE;
  const jkmEmployerRate = bpjsConfig ? bpjsConfig.jkm_employer_rate / 100 : BPJS_JKM_EMPLOYER_RATE;

  // Employee BPJS - based on basic salary only
  const bpjsKesSalary = Math.min(basicSalary, kesMaxSalary);
  const bpjsJpSalary = Math.min(basicSalary, jpMaxSalary);
  const bpjsKesehatan = bpjsKesehatanEnabled ? Math.round(bpjsKesSalary * kesEmployeeRate) : 0;
  const bpjsJhtEmployee = Math.round(basicSalary * jhtEmployeeRate);
  const bpjsJpEmployee = Math.round(bpjsJpSalary * jpEmployeeRate);
  const bpjsKetenagakerjaan = bpjsJhtEmployee + bpjsJpEmployee;

  // Employer BPJS - based on basic salary only
  const bpjsKesEmployer = bpjsKesehatanEnabled ? Math.round(bpjsKesSalary * kesEmployerRate) : 0;
  const bpjsJhtEmployer = Math.round(basicSalary * jhtEmployerRate);
  const bpjsJpEmployer = Math.round(bpjsJpSalary * jpEmployerRate);
  const bpjsJkkEmployer = Math.round(basicSalary * jkkEmployerRate);
  const bpjsJkmEmployer = Math.round(basicSalary * jkmEmployerRate);

  // Bruto = Gaji Pokok + Semua Tunjangan/Tambahan + BPJS Perusahaan
  const totalBpjsEmployer = bpjsKesEmployer + bpjsJhtEmployer + bpjsJpEmployer + bpjsJkkEmployer + bpjsJkmEmployer;
  const brutoIncome = basicSalary + allowance + overtimeTotal + totalBpjsEmployer;

  const totalBpjsEmployee = bpjsKesehatan + bpjsKetenagakerjaan;
  const nettoIncome = brutoIncome - totalBpjsEmployee - totalBpjsEmployer;

  // Use dynamic PTKP config if available, fallback to hardcoded defaults
  const effectivePtkp = ptkpConfig || PTKP_VALUES;
  const ptkpValue = effectivePtkp[ptkpStatus] || effectivePtkp["TK/0"] || PTKP_VALUES["TK/0"];

  let pph21Monthly: number;
  let pph21Mode = "progressive";
  let pph21TerRate = 0;
  let pkp: number;

  // Determine calculation mode
  const hasTER = terRates && terRates.length > 0 && month;

  if (hasTER && month < 12) {
    // Jan-Nov: Use TER — no rounding, keep decimal precision like Excel
    const terResult = calculatePPh21TER(brutoIncome, terRates);
    pph21Monthly = terResult.tax;
    pph21Mode = "TER";
    pph21TerRate = terResult.rate;
    // PKP not used in TER but we still calculate for display
    const annualNetto = nettoIncome * 12;
    pkp = Math.max(0, annualNetto - ptkpValue);
  } else if (hasTER && month === 12) {
    // December: Reconciliation using actual yearly data
    // Yearly bruto = Jan-Nov actual + December current
    const yearlyBruto = prevMonthsBruto + brutoIncome;
    // Yearly JHT+JP employee = Jan-Nov actual + December current
    const yearlyBpjsKt = prevMonthsBpjsKt + bpjsKetenagakerjaan;

    const reconResult = calculatePPh21Reconciliation(yearlyBruto, yearlyBpjsKt, ptkpValue, totalPphJanNov);
    pph21Monthly = reconResult.tax; // Can be negative (refund)
    pph21Mode = "REKONSILIASI";
    pph21TerRate = 0;
    pkp = reconResult.pkp;
  } else {
    // Fallback: Progressive (no TER data available)
    // Use Biaya Jabatan formula for consistency
    const annualBruto = brutoIncome * 12;
    const annualBpjsKt = bpjsKetenagakerjaan * 12;
    const biayaJabatan = Math.min(annualBruto * BIAYA_JABATAN_RATE, BIAYA_JABATAN_MAX_YEARLY);
    const annualNetto = annualBruto - biayaJabatan - annualBpjsKt;
    pkp = Math.max(0, annualNetto - ptkpValue);
    pph21Monthly = calculatePPh21Monthly(pkp);
    pph21Mode = "progressive";
  }

  // THP = Netto - PPh21 - Pinjaman - Potongan Lain (no rounding, keep decimal like Excel)
  const takeHomePay = nettoIncome - pph21Monthly - loanDeduction - otherDeduction;

  return {
    basic_salary: basicSalary,
    allowance,
    overtime_total: overtimeTotal,
    overtime_hours: overtimeHours,
    bruto_income: brutoIncome,
    bpjs_kesehatan: bpjsKesehatan,
    bpjs_ketenagakerjaan: bpjsKetenagakerjaan,
    bpjs_kes_employer: bpjsKesEmployer,
    bpjs_jht_employer: bpjsJhtEmployer,
    bpjs_jp_employer: bpjsJpEmployer,
    bpjs_jkk_employer: bpjsJkkEmployer,
    bpjs_jkm_employer: bpjsJkmEmployer,
    netto_income: nettoIncome,
    ptkp_status: ptkpStatus,
    ptkp_value: ptkpValue,
    pkp,
    pph21_monthly: pph21Monthly,
    take_home_pay: takeHomePay,
    loan_deduction: loanDeduction,
    other_deduction: otherDeduction,
    deduction_notes: deductionNotes,
    pph21_mode: pph21Mode,
    pph21_ter_rate: pph21TerRate,
  };
}

export function calculateOvertimePay(monthlySalary: number, overtimeHours: number): number {
  if (overtimeHours <= 0) return 0;
  const hourlyRate = monthlySalary / 173;
  const firstHourPay = Math.min(overtimeHours, 1) * hourlyRate * 1.5;
  const remainingHours = Math.max(0, overtimeHours - 1);
  const remainingPay = remainingHours * hourlyRate * 2;
  return Math.round(firstHourPay + remainingPay);
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
