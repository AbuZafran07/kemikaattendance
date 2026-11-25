import { test, expect } from 'bun:test';
import { calculatePayroll, calculatePPh21Reconciliation, calculateBiayaJabatan, getTaxableBruto, getJpSalaryCap, summarizeTaxYear, isResignTaxPeriod, getEmployerBpjs, getPayrollEmployerCost } from './payrollCalculation';
import { getFullMonthlyWage, getThrWage, getLeaveShortfall, preservePaidComponents } from './payrollPolicy';

const config = { kes_employee_rate:1, kes_employer_rate:4, kes_max_salary:12000000, jht_employee_rate:2, jht_employer_rate:3.7, jp_employee_rate:1, jp_employer_rate:2, jp_max_salary:11086300, jkk_employer_rate:0.24, jkm_employer_rate:0.3, base_calculation:'basic_plus_fixed', fixed_allowance_components:{jabatan:true, komunikasi:false, operasional:true}, jp_max_salary_history:[{effective_from:'2025-03-01',value:10547400},{effective_from:'2026-03-01',value:11086300}] };
const terA = [{ bruto_min:0,bruto_max:5400000,tarif_efektif:0 },{bruto_min:5400000.01,bruto_max:5650000,tarif_efektif:0.25 }];
test('Dhimas October production inputs yield taxable bruto 5,156,005 and zero TER', () => {
  const row = calculatePayroll({ basicSalary:4500000, allowance:451705, overtimeTotal:0, overtimeHours:0, ptkpStatus:'TK/0', month:10,year:2026, terRates:terA,bpjsConfig:config });
  expect(row.bruto_income).toBe(5156005); expect(row.pph21_monthly).toBe(0); expect(row.netto_income).toBe(4771705); expect(row.bruto_basis).toBe('pph_taxable');
});
test('Haris October production inputs preserve legacy JP when reproducing October fixture', () => {
  const row = calculatePayroll({basicSalary:36190000,allowance:11629751,fixedAllowance:7738000,overtimeTotal:0,overtimeHours:0,ptkpStatus:'K/3',month:10,year:2026,terRates:[{bruto_min:46200001,bruto_max:51200000,tarif_efektif:17}],bpjsConfig:{...config,jp_max_salary:10547400,jp_max_salary_history:[]} });
  expect(row.bruto_income).toBe(48536962); expect(row.pph21_monthly).toBeCloseTo(8251283.54,2); expect(row.bpjs_jht_employer).toBe(1625336); expect(row.bpjs_jp_employer).toBe(210948);
});
test('THP changes only by PPh difference for identical wage and contribution inputs', () => {
  const row = calculatePayroll({basicSalary:4500000,allowance:451705,overtimeTotal:0,overtimeHours:0,ptkpStatus:'TK/0',month:10,year:2026,terRates:terA,bpjsConfig:config});
  const previousNetto=5412505-45000-135000-460800;
  const previousPph=13531.2625;
  expect(row.netto_income).toBe(previousNetto); expect(row.take_home_pay-(previousNetto-previousPph)).toBeCloseTo(previousPph-row.pph21_monthly,8);
});
test('mixed legacy and taxable months are aggregated without subtracting employer contributions twice', () => {
  const old={month:1,bruto_income:5412505,bruto_basis:'legacy_incl_jht_jp',bpjs_jht_employer:166500,bpjs_jp_employer:90000,bpjs_ketenagakerjaan:135000,pph21_monthly:13531.2625};
  const modern={...old,month:11,bruto_basis:'pph_taxable',bruto_income:5156005,pph21_monthly:0};
  expect(getTaxableBruto(old)).toBe(5156005); expect(getTaxableBruto(modern)).toBe(5156005);
  const summary=summarizeTaxYear([...Array.from({length:10},(_,i)=>({...old,month:i+1})),modern]);
  expect(summary.bruto).toBe(56716055); expect(summary.monthsWorked).toBe(11);
  const result=calculatePPh21Reconciliation(summary.bruto+5156005,summary.bpjsEmployee+135000,54000000,summary.withheld,0.05,6000000,undefined,12);
  expect(result.tax).toBeCloseTo(result.yearlyTax-135312.625,6);
});
test('negative last-period adjustment refunds over-withheld tax and raises THP', () => {
  const row=calculatePayroll({basicSalary:4500000,allowance:451705,overtimeTotal:0,overtimeHours:0,ptkpStatus:'TK/0',month:12,year:2026,prevMonthsBruto:0,prevMonthsBpjsKt:0,totalPphJanNov:13531.2625,bpjsConfig:config,monthsWorked:1});
  expect(row.pph21_monthly).toBe(-13531.2625); expect(row.take_home_pay).toBe(4785236.2625);
});
test('JP February 2026 cap is 10,547,400',()=>{expect(getJpSalaryCap(config,2,2026)).toBe(10547400);});
test('JP March 2026 cap is 11,086,300',()=>{expect(getJpSalaryCap(config,3,2026)).toBe(11086300);});
test('JP actual contributions switch by payroll month',()=>{const input={basicSalary:15000000,allowance:0,overtimeTotal:0,overtimeHours:0,ptkpStatus:'TK/0',year:2026,bpjsConfig:config};expect(calculatePayroll({...input,month:2}).bpjs_jp_employer).toBe(210948);expect(calculatePayroll({...input,month:3}).bpjs_jp_employer).toBe(221726);});
test('12-month biaya jabatan capped at 6 million',()=>{expect(calculateBiayaJabatan(180000000,12)).toBe(6000000);});
test('four-month biaya jabatan capped at 2 million',()=>{expect(calculateBiayaJabatan(180000000,4)).toBe(2000000);});
test('below-cap biaya jabatan remains five percent',()=>{expect(calculateBiayaJabatan(50000000,12)).toBe(2500000);});
test('biaya jabatan respects configured rate and annual cap',()=>{expect(calculateBiayaJabatan(180000000,4,0.04,4800000)).toBe(1600000);});
test('Tuan X training example annual PKP, tax and December adjustment',()=>{const r=calculatePPh21Reconciliation(180000000,5940000,54000000,9900000);expect(r.pkp).toBe(114060000);expect(r.yearlyTax).toBe(11109000);expect(r.tax).toBe(1209000);});
test('Tuan R K/0 training example pension deduction and December 515,000',()=>{const r=calculatePPh21Reconciliation(120000000,1200000,58500000,2200000);expect(r.yearlyTax).toBe(2715000);expect(r.tax).toBe(515000);});
test('resign month uses same reconciliation as December and allows refunds',()=>{const input={basicSalary:4500000,allowance:0,overtimeTotal:0,overtimeHours:0,ptkpStatus:'TK/0',year:2026,bpjsConfig:config,monthsWorked:4,prevMonthsBruto:15000000,prevMonthsBpjsKt:405000,totalPphJanNov:100000,terRates:terA};const resign=calculatePayroll({...input,month:4,lastTaxPeriod:true});const dec=calculatePayroll({...input,month:12});expect(resign.pph21_mode).toBe('REKONSILIASI');expect(resign.pph21_monthly).toBe(-100000);expect(resign.pph21_monthly).toBe(dec.pph21_monthly);});
test('resign cutoff boundaries include the 20th but not the 21st',()=>{expect(isResignTaxPeriod(new Date(2026,3,20),new Date(2026,2,21),new Date(2026,3,20))).toBe(true);expect(isResignTaxPeriod(new Date(2026,3,21),new Date(2026,2,21),new Date(2026,3,20))).toBe(false);});
test('Ibrahim full fixed allowance wage gives hourly base (5,191,200+1,260,000)/173',()=>{expect(getFullMonthlyWage({basic_salary:5191200,tunjangan_operasional:1260000},'basic_plus_fixed',config)/173).toBe(6451200/173);});
test('false fixed components and basic-only fallback exclude allowances',()=>{const p={basic_salary:5191200,tunjangan_operasional:1260000,tunjangan_jabatan:100000};expect(getFullMonthlyWage(p,'basic_plus_fixed',{...config,fixed_allowance_components:{jabatan:false,operasional:false}})).toBe(5191200);expect(getFullMonthlyWage(p,'basic_only',config)).toBe(5191200);});
test('THR 2026 uses historical basic-only while 2027 uses fixed wage',()=>{const p={basic_salary:5191200,tunjangan_operasional:1260000};expect(getThrWage(p,2026,'basic_plus_fixed',config)).toBe(5191200);expect(getThrWage(p,2027,'basic_plus_fixed',config)).toBe(6451200);});
test('employer cost retains all BPJS despite taxable bruto excluding JHT and JP',()=>{const row=calculatePayroll({basicSalary:4500000,allowance:451705,overtimeTotal:0,overtimeHours:0,ptkpStatus:'TK/0',month:10,year:2026,bpjsConfig:config});expect(getEmployerBpjs(row)).toBe(460800);expect(getPayrollEmployerCost(row)).toBe(5412505);});
test('unaccommodated leave is a note at full wage divided by 25',()=>{expect(getLeaveShortfall(8,3,6451200)).toEqual({days:5,amount:1290240});expect(getLeaveShortfall(3,8,6451200)).toEqual({days:0,amount:0});});
test('November regeneration retains paid 2026 THR and overtime',()=>{expect(preservePaidComponents(2026,11,{thr:5000000,overtime_total:123456,overtime_hours:3},{thr:6500000,overtime_total:200000,overtime_hours:4})).toEqual({thr:5000000,overtime_total:123456,overtime_hours:3});});
test('December can use new overtime while retaining existing 2026 THR',()=>{expect(preservePaidComponents(2026,12,{thr:5000000,overtime_total:123456,overtime_hours:3},{thr:6500000,overtime_total:200000,overtime_hours:4})).toEqual({thr:5000000,overtime_total:200000,overtime_hours:4});});
test('2027 uses new calculated THR and overtime',()=>{expect(preservePaidComponents(2027,3,{thr:5000000,overtime_total:123456,overtime_hours:3},{thr:6500000,overtime_total:200000,overtime_hours:4})).toEqual({thr:6500000,overtime_total:200000,overtime_hours:4});});