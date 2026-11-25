import { test, expect } from 'bun:test';
import { splitBpjsKtEmployee } from './payrollCalculation';

const config = {
  base_calculation: 'basic_plus_fixed', base_calculation_effective_date: '2026-06-02',
  fixed_allowance_components: { jabatan: true, operasional: true, komunikasi: false },
  jp_employee_rate: 1, jht_employee_rate: 2, jp_max_salary: 11086300,
  jp_max_salary_history: [{ effective_from: '2025-03-01', value: 10547400 }, { effective_from: '2026-03-01', value: 11086300 }],
};
const row = (base, total) => ({ basic_salary: base, tunjangan_jabatan: 0, tunjangan_operasional: 0, bpjs_ketenagakerjaan: total });
test('Haris November: saved 989423 splits into JHT 878560 and JP 110863', () => {
  expect(splitBpjsKtEmployee(row(43928000, 989423), config, 11, 2026)).toEqual({ jht: 878560, jp: 110863, estimated: false });
});
test('Iin November: saved 609083 splits into JHT 498220 and JP 110863', () => {
  expect(splitBpjsKtEmployee(row(24911000, 609083), config, 11, 2026)).toEqual({ jht: 498220, jp: 110863, estimated: false });
});
test('Deni below cap: saved 95295 splits into JHT 63530 and JP 31765', () => {
  expect(splitBpjsKtEmployee(row(3176500, 95295), config, 11, 2026)).toEqual({ jht: 63530, jp: 31765, estimated: false });
});
test('February uses JP cap 10547400', () => {
  expect(splitBpjsKtEmployee(row(20000000, 505474), config, 2, 2026).jp).toBe(105474);
});
test('March uses JP cap 11086300', () => {
  expect(splitBpjsKtEmployee(row(20000000, 510863), config, 3, 2026).jp).toBe(110863);
});
test('May uses saved basic salary only, not saved fixed allowances', () => {
  expect(splitBpjsKtEmployee({ ...row(4000000, 120000), tunjangan_jabatan: 500000, tunjangan_operasional: 1500000 }, config, 5, 2026).jp).toBe(40000);
});
test('June uses the policy effective June 2 for the monthly payroll', () => {
  expect(splitBpjsKtEmployee({ ...row(4000000, 180000), tunjangan_jabatan: 500000, tunjangan_operasional: 1500000 }, config, 6, 2026).jp).toBe(60000);
});
test('July adds only enabled saved fixed allowances and never communication', () => {
  expect(splitBpjsKtEmployee({ ...row(4000000, 165000), tunjangan_jabatan: 500000, tunjangan_operasional: 1500000, tunjangan_komunikasi: 1000000 }, { ...config, fixed_allowance_components: { jabatan: false, operasional: true } }, 7, 2026).jp).toBe(55000);
});
test('JP above saved total safely retains legacy split and marks estimate', () => {
  expect(splitBpjsKtEmployee(row(20000000, 30000), config, 11, 2026)).toEqual({ jht: 20000, jp: 10000, estimated: true });
});
test('missing saved BPJS basis safely falls back, without profile substitution', () => {
  expect(splitBpjsKtEmployee({ bpjs_ketenagakerjaan: 95295 }, config, 11, 2026)).toEqual({ jht: 63530, jp: 31765, estimated: true });
});
test('missing selected allowance safely falls back', () => {
  expect(splitBpjsKtEmployee({ basic_salary: 4000000, bpjs_ketenagakerjaan: 150000 }, config, 11, 2026)).toEqual({ jht: 100000, jp: 50000, estimated: true });
});
test('unavailable config or dated history safely falls back', () => {
  for (const c of [undefined, { ...config, jp_max_salary_history: [] }, { ...config, base_calculation_effective_date: undefined }]) {
    expect(splitBpjsKtEmployee(row(20000000, 510863), c, 11, 2026)).toEqual({ jht: 340575, jp: 170288, estimated: true });
  }
});
test('stored zero deduction stays zero without a spurious estimate', () => {
  expect(splitBpjsKtEmployee(row(20000000, 0), config, 11, 2026)).toEqual({ jht: 0, jp: 0, estimated: false });
});
test('split always preserves stored combined total and leaves source payroll untouched', () => {
  for (const total of [1, 2, 95295, 609083, 989423]) {
    const saved = { ...row(43928000, total), bpjs_kesehatan: 120000, pph21_monthly: 17423355.1398, take_home_pay: 181688812.7902, bruto_income: 209157775 };
    const before = JSON.stringify(saved);
    const split = splitBpjsKtEmployee(saved, config, 11, 2026);
    expect(split.jht + split.jp).toBe(total);
    expect(JSON.stringify(saved)).toBe(before);
  }
});