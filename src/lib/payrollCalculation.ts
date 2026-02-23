/**
 * Indonesian Payroll Calculation Engine
 * Based on PPh 21 regulations (UU HPP 2022)
 */

// PTKP values (Penghasilan Tidak Kena Pajak) - 2024
export const PTKP_VALUES: Record<string, number> = {
  "TK/0": 54000000,    // Tidak Kawin, tanpa tanggungan
  "TK/1": 58500000,    // Tidak Kawin, 1 tanggungan
  "TK/2": 63000000,    // Tidak Kawin, 2 tanggungan
  "TK/3": 67500000,    // Tidak Kawin, 3 tanggungan
  "K/0": 58500000,     // Kawin, tanpa tanggungan
  "K/1": 63000000,     // Kawin, 1 tanggungan
  "K/2": 67500000,     // Kawin, 2 tanggungan
  "K/3": 72000000,     // Kawin, 3 tanggungan
  "K/I/0": 112500000,  // Kawin, penghasilan istri digabung, 0 tanggungan
  "K/I/1": 117000000,  // Kawin, penghasilan istri digabung, 1 tanggungan
  "K/I/2": 121500000,  // Kawin, penghasilan istri digabung, 2 tanggungan
  "K/I/3": 126000000,  // Kawin, penghasilan istri digabung, 3 tanggungan
};

export const PTKP_OPTIONS = Object.keys(PTKP_VALUES);

// BPJS rates (employee portion)
export const BPJS_KESEHATAN_RATE = 0.01;      // 1% employee (4% employer)
export const BPJS_KETENAGAKERJAAN_RATE = 0.02; // JHT 2% employee (3.7% employer)
export const BPJS_JP_RATE = 0.01;              // JP 1% employee (2% employer)

// PPh 21 progressive tax brackets (UU HPP)
const TAX_BRACKETS = [
  { limit: 60000000, rate: 0.05 },    // 5% for first 60M
  { limit: 250000000, rate: 0.15 },   // 15% for 60M-250M
  { limit: 500000000, rate: 0.25 },   // 25% for 250M-500M
  { limit: 5000000000, rate: 0.30 },  // 30% for 500M-5B
  { limit: Infinity, rate: 0.35 },     // 35% for >5B
];

// BPJS Kesehatan max salary cap (2024)
const BPJS_KES_MAX_SALARY = 12000000;

/**
 * Calculate PPh 21 annual tax using progressive brackets
 */
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

/**
 * Calculate monthly PPh 21
 */
export function calculatePPh21Monthly(pkp: number): number {
  const annualTax = calculatePPh21Annual(pkp);
  return Math.round(annualTax / 12);
}

export interface PayrollInput {
  basicSalary: number;
  allowance: number;
  overtimeTotal: number;
  ptkpStatus: string;
  overtimeHours: number;
}

export interface PayrollResult {
  basic_salary: number;
  allowance: number;
  overtime_total: number;
  overtime_hours: number;
  bruto_income: number;
  bpjs_kesehatan: number;
  bpjs_ketenagakerjaan: number;
  netto_income: number;
  ptkp_status: string;
  ptkp_value: number;
  pkp: number;
  pph21_monthly: number;
  take_home_pay: number;
}

/**
 * Calculate full payroll for an employee
 */
export function calculatePayroll(input: PayrollInput): PayrollResult {
  const { basicSalary, allowance, overtimeTotal, ptkpStatus, overtimeHours } = input;

  // 1. Bruto = Gaji Pokok + Tunjangan + Lembur
  const brutoIncome = basicSalary + allowance + overtimeTotal;

  // 2. BPJS Kesehatan (1% employee, capped at max salary)
  const bpjsKesSalary = Math.min(brutoIncome, BPJS_KES_MAX_SALARY);
  const bpjsKesehatan = Math.round(bpjsKesSalary * BPJS_KESEHATAN_RATE);

  // 3. BPJS Ketenagakerjaan (JHT 2% + JP 1% = 3%)
  const bpjsKetenagakerjaan = Math.round(brutoIncome * (BPJS_KETENAGAKERJAAN_RATE + BPJS_JP_RATE));

  // 4. Netto = Bruto - BPJS
  const totalBpjs = bpjsKesehatan + bpjsKetenagakerjaan;
  const nettoIncome = brutoIncome - totalBpjs;

  // 5. PTKP
  const ptkpValue = PTKP_VALUES[ptkpStatus] || PTKP_VALUES["TK/0"];

  // 6. PKP = (Netto x 12) - PTKP (annualized)
  const annualNetto = nettoIncome * 12;
  const pkp = Math.max(0, annualNetto - ptkpValue);

  // 7. PPh 21 monthly
  const pph21Monthly = calculatePPh21Monthly(pkp);

  // 8. Take Home Pay = Netto - PPh21 Monthly
  const takeHomePay = nettoIncome - pph21Monthly;

  return {
    basic_salary: basicSalary,
    allowance,
    overtime_total: overtimeTotal,
    overtime_hours: overtimeHours,
    bruto_income: brutoIncome,
    bpjs_kesehatan: bpjsKesehatan,
    bpjs_ketenagakerjaan: bpjsKetenagakerjaan,
    netto_income: nettoIncome,
    ptkp_status: ptkpStatus,
    ptkp_value: ptkpValue,
    pkp,
    pph21_monthly: pph21Monthly,
    take_home_pay: takeHomePay,
  };
}

/**
 * Calculate overtime pay based on Indonesian labor law
 * Kepmenaker No. 102/MEN/VI/2004
 * 
 * Weekday overtime:
 * - First hour: 1.5x hourly rate
 * - Subsequent hours: 2x hourly rate
 * 
 * Hourly rate = 1/173 x monthly salary
 */
export function calculateOvertimePay(monthlySalary: number, overtimeHours: number): number {
  if (overtimeHours <= 0) return 0;

  const hourlyRate = monthlySalary / 173;
  
  // First hour at 1.5x
  const firstHourPay = Math.min(overtimeHours, 1) * hourlyRate * 1.5;
  
  // Remaining hours at 2x
  const remainingHours = Math.max(0, overtimeHours - 1);
  const remainingPay = remainingHours * hourlyRate * 2;

  return Math.round(firstHourPay + remainingPay);
}

/**
 * Format currency to Indonesian Rupiah
 */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
