import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const GREEN: [number, number, number] = [0, 135, 81];
const DARK_GREEN: [number, number, number] = [0, 100, 60];
const LIGHT_GREEN: [number, number, number] = [230, 245, 235];
const WHITE: [number, number, number] = [255, 255, 255];
const GRAY_TEXT: [number, number, number] = [80, 80, 80];
const DARK_TEXT: [number, number, number] = [30, 30, 30];

const MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export const loadImageAsBase64 = (src: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      c.getContext("2d")!.drawImage(img, 0, 0);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = src;
  });

function fmtRp(amount: number): string {
  if (!amount || amount === 0) return "-";
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

function fmtRpDecimal(amount: number): string {
  if (!amount || amount === 0) return "-";
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export interface PayrollReportItem {
  employee_name: string;
  nik: string;
  jabatan: string;
  departemen: string;
  ptkp_status: string;
  basic_salary: number;
  allowance: number;
  tunjangan_komunikasi: number;
  tunjangan_jabatan: number;
  tunjangan_operasional: number;
  tunjangan_kesehatan: number;
  overtime_total: number;
  overtime_hours: number;
  thr: number;
  insentif_kinerja: number;
  insentif_penjualan: number;
  bonus_tahunan: number;
  bonus_lainnya: number;
  pengembalian_employee: number;
  bpjs_ketenagakerjaan: number;
  bpjs_kesehatan: number;
  loan_deduction: number;
  other_deduction: number;
  pph21_monthly: number;
  pph21_mode: string;
  pph21_ter_rate: number | null;
  bruto_income: number;
  netto_income: number;
  take_home_pay: number;
  bpjs_jht_employer: number;
  bpjs_jp_employer: number;
  bpjs_jkk_employer: number;
  bpjs_jkm_employer: number;
  bpjs_kes_employer: number;
}

export async function generatePayrollReportPDF(
  items: PayrollReportItem[],
  month: number,
  year: number,
  logoSrc: string
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth(); // ~297
  const ph = doc.internal.pageSize.getHeight(); // ~210
  const mx = 8;
  const rightEnd = pw - mx;
  const periodLabel = `${MONTHS_ID[month - 1]} ${year}`;
  const generatedDate = new Date().toLocaleString("id-ID", {
    day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  // ===== PAGE 1: COVER / SUMMARY =====
  // Background accent
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, pw, 50, "F");

  // Logo
  try {
    const logoBase64 = await loadImageAsBase64(logoSrc);
    doc.addImage(logoBase64, "PNG", mx + 2, 8, 45, 20);
  } catch {}

  // Title
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...WHITE);
  doc.text("LAPORAN PAYROLL", pw / 2, 20, { align: "center" });
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text(`Periode: ${periodLabel}`, pw / 2, 30, { align: "center" });

  // Company name on right
  doc.setFontSize(10);
  doc.text("PT. KEMIKA KARYA PRATAMA", rightEnd - 2, 14, { align: "right" });
  doc.setFontSize(8);
  doc.text(`Dicetak: ${generatedDate}`, rightEnd - 2, 20, { align: "right" });

  // Thin accent line
  doc.setFillColor(...DARK_GREEN);
  doc.rect(0, 50, pw, 2, "F");

  // ===== SUMMARY CARDS =====
  let y = 60;
  const totalEmployees = items.length;
  const totalBruto = items.reduce((s, i) => s + i.bruto_income, 0);
  const totalDeductions = items.reduce((s, i) => s + i.bpjs_ketenagakerjaan + i.bpjs_kesehatan + i.loan_deduction + i.other_deduction + i.pph21_monthly, 0);
  const totalTHP = items.reduce((s, i) => s + i.take_home_pay, 0);
  const totalPPh = items.reduce((s, i) => s + i.pph21_monthly, 0);
  const totalEmployerBpjs = items.reduce((s, i) => s + i.bpjs_kes_employer + i.bpjs_jht_employer + i.bpjs_jp_employer + i.bpjs_jkk_employer + i.bpjs_jkm_employer, 0);

  const cardW = (pw - mx * 2 - 12 * 2) / 3;
  const cards = [
    { label: "Total Karyawan", value: String(totalEmployees), sub: "orang" },
    { label: "Total Penghasilan Bruto", value: `Rp ${fmtRp(totalBruto)}`, sub: "" },
    { label: "Total Take Home Pay", value: `Rp ${fmtRp(totalTHP)}`, sub: "" },
  ];

  cards.forEach((card, idx) => {
    const cx = mx + idx * (cardW + 12);
    // Card background
    doc.setFillColor(...LIGHT_GREEN);
    doc.roundedRect(cx, y, cardW, 28, 3, 3, "F");
    // Card border
    doc.setDrawColor(...GREEN);
    doc.setLineWidth(0.5);
    doc.roundedRect(cx, y, cardW, 28, 3, 3, "S");
    // Label
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GRAY_TEXT);
    doc.text(card.label, cx + cardW / 2, y + 10, { align: "center" });
    // Value
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK_TEXT);
    doc.text(card.value + (card.sub ? ` ${card.sub}` : ""), cx + cardW / 2, y + 22, { align: "center" });
  });

  y += 36;

  // Second row of summary cards
  const cards2 = [
    { label: "Total PPh 21", value: `Rp ${fmtRp(totalPPh)}` },
    { label: "Total Potongan", value: `Rp ${fmtRp(totalDeductions)}` },
    { label: "Total BPJS Perusahaan", value: `Rp ${fmtRp(totalEmployerBpjs)}` },
  ];

  cards2.forEach((card, idx) => {
    const cx = mx + idx * (cardW + 12);
    doc.setFillColor(245, 248, 250);
    doc.roundedRect(cx, y, cardW, 24, 3, 3, "F");
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.roundedRect(cx, y, cardW, 24, 3, 3, "S");
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GRAY_TEXT);
    doc.text(card.label, cx + cardW / 2, y + 9, { align: "center" });
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK_TEXT);
    doc.text(card.value, cx + cardW / 2, y + 19, { align: "center" });
  });

  y += 32;

  // Department breakdown
  const deptMap = new Map<string, { count: number; bruto: number; thp: number }>();
  items.forEach((i) => {
    const dept = i.departemen || "Lainnya";
    const d = deptMap.get(dept) || { count: 0, bruto: 0, thp: 0 };
    d.count++;
    d.bruto += i.bruto_income;
    d.thp += i.take_home_pay;
    deptMap.set(dept, d);
  });

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK_TEXT);
  doc.text("Ringkasan per Departemen", mx, y + 2);
  y += 6;

  autoTable(doc, {
    startY: y,
    head: [["Departemen", "Jumlah Karyawan", "Total Bruto", "Total THP"]],
    body: Array.from(deptMap.entries()).map(([dept, d]) => [
      dept,
      String(d.count),
      `Rp ${fmtRp(d.bruto)}`,
      `Rp ${fmtRp(d.thp)}`,
    ]),
    margin: { left: mx, right: mx },
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: GREEN, textColor: WHITE, fontStyle: "bold", halign: "center" },
    columnStyles: {
      0: { halign: "left" },
      1: { halign: "center" },
      2: { halign: "right" },
      3: { halign: "right" },
    },
    alternateRowStyles: { fillColor: [245, 250, 245] },
  });

  // Footer on page 1
  addFooter(doc, pw, ph, 1, periodLabel);

  // ===== PAGE 2: DETAIL TABLE - INCOME =====
  doc.addPage("a4", "landscape");
  addPageHeader(doc, pw, "DETAIL PENGHASILAN KARYAWAN", periodLabel, mx, rightEnd);

  const incomeRows = items.map((item, idx) => {
    const fixedTotal = (item.tunjangan_komunikasi || 0) + (item.tunjangan_jabatan || 0) + (item.tunjangan_operasional || 0);
    const incidentalTotal = (item.tunjangan_kesehatan || 0) + (item.bonus_tahunan || 0) + (item.thr || 0)
      + (item.insentif_kinerja || 0) + (item.bonus_lainnya || 0) + (item.pengembalian_employee || 0) + (item.insentif_penjualan || 0);
    const tunjanganKehadiran = Math.max(0, item.allowance - fixedTotal - incidentalTotal);

    return [
      String(idx + 1),
      item.nik || "-",
      item.employee_name || "-",
      item.departemen || "-",
      fmtRp(item.basic_salary),
      fmtRp(tunjanganKehadiran),
      fmtRp(item.tunjangan_operasional || 0),
      fmtRp(item.tunjangan_jabatan || 0),
      fmtRp(item.tunjangan_komunikasi || 0),
      fmtRp(item.tunjangan_kesehatan || 0),
      fmtRp(item.overtime_total || 0),
      fmtRp(item.thr || 0),
      fmtRp((item.insentif_kinerja || 0) + (item.insentif_penjualan || 0) + (item.bonus_tahunan || 0) + (item.bonus_lainnya || 0) + (item.pengembalian_employee || 0)),
      fmtRp(item.bruto_income),
    ];
  });

  // Totals row
  const incomeTotals = [
    "", "", `TOTAL (${items.length} orang)`, "",
    fmtRp(items.reduce((s, i) => s + i.basic_salary, 0)),
    fmtRp(items.reduce((s, i) => {
      const f = (i.tunjangan_komunikasi || 0) + (i.tunjangan_jabatan || 0) + (i.tunjangan_operasional || 0);
      const inc = (i.tunjangan_kesehatan || 0) + (i.bonus_tahunan || 0) + (i.thr || 0) + (i.insentif_kinerja || 0) + (i.bonus_lainnya || 0) + (i.pengembalian_employee || 0) + (i.insentif_penjualan || 0);
      return s + Math.max(0, i.allowance - f - inc);
    }, 0)),
    fmtRp(items.reduce((s, i) => s + (i.tunjangan_operasional || 0), 0)),
    fmtRp(items.reduce((s, i) => s + (i.tunjangan_jabatan || 0), 0)),
    fmtRp(items.reduce((s, i) => s + (i.tunjangan_komunikasi || 0), 0)),
    fmtRp(items.reduce((s, i) => s + (i.tunjangan_kesehatan || 0), 0)),
    fmtRp(items.reduce((s, i) => s + (i.overtime_total || 0), 0)),
    fmtRp(items.reduce((s, i) => s + (i.thr || 0), 0)),
    fmtRp(items.reduce((s, i) => s + (i.insentif_kinerja || 0) + (i.insentif_penjualan || 0) + (i.bonus_tahunan || 0) + (i.bonus_lainnya || 0) + (i.pengembalian_employee || 0), 0)),
    fmtRp(totalBruto),
  ];

  autoTable(doc, {
    startY: 24,
    head: [["No", "NIK", "Nama", "Dept", "Gaji Pokok", "T. Kehadiran", "T. Operasional", "T. Jabatan", "T. Komunikasi", "T. Kesehatan", "Lembur", "THR", "Bonus & Insentif", "Total Bruto"]],
    body: [...incomeRows, incomeTotals],
    margin: { left: mx, right: mx },
    styles: { fontSize: 6.5, cellPadding: 1.8, lineWidth: 0.1, lineColor: [200, 200, 200] },
    headStyles: { fillColor: GREEN, textColor: WHITE, fontStyle: "bold", fontSize: 6.5, halign: "center", cellPadding: 2.5 },
    columnStyles: {
      0: { halign: "center", cellWidth: 8 },
      1: { cellWidth: 18 },
      2: { cellWidth: 32 },
      3: { cellWidth: 20 },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
      8: { halign: "right" },
      9: { halign: "right" },
      10: { halign: "right" },
      11: { halign: "right" },
      12: { halign: "right" },
      13: { halign: "right", fontStyle: "bold" },
    },
    alternateRowStyles: { fillColor: [248, 252, 248] },
    didParseCell(data) {
      // Style totals row
      if (data.row.index === incomeRows.length) {
        data.cell.styles.fillColor = LIGHT_GREEN;
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fontSize = 7;
      }
    },
  });

  addFooter(doc, pw, ph, 2, periodLabel);

  // ===== PAGE 3: DETAIL TABLE - DEDUCTIONS & THP =====
  doc.addPage("a4", "landscape");
  addPageHeader(doc, pw, "DETAIL POTONGAN & TAKE HOME PAY", periodLabel, mx, rightEnd);

  const deductionRows = items.map((item, idx) => {
    const jhtEmp = Math.round(item.bpjs_ketenagakerjaan * 2 / 3);
    const jpEmp = item.bpjs_ketenagakerjaan - jhtEmp;
    const pph21Label = item.pph21_mode === "TER" && item.pph21_ter_rate != null
      ? `TER ${item.pph21_ter_rate.toFixed(2)}%`
      : item.pph21_mode || "-";

    return [
      String(idx + 1),
      item.nik || "-",
      item.employee_name || "-",
      fmtRp(item.bruto_income),
      fmtRp(jhtEmp),
      fmtRp(jpEmp),
      fmtRp(item.bpjs_kesehatan),
      fmtRp(item.loan_deduction || 0),
      fmtRp(item.other_deduction || 0),
      pph21Label,
      fmtRp(item.pph21_monthly),
      fmtRp(item.bpjs_ketenagakerjaan + item.bpjs_kesehatan + (item.loan_deduction || 0) + (item.other_deduction || 0) + item.pph21_monthly),
      fmtRp(item.take_home_pay),
    ];
  });

  const deductionTotals = [
    "", "", `TOTAL`,
    fmtRp(totalBruto),
    fmtRp(items.reduce((s, i) => s + Math.round(i.bpjs_ketenagakerjaan * 2 / 3), 0)),
    fmtRp(items.reduce((s, i) => s + (i.bpjs_ketenagakerjaan - Math.round(i.bpjs_ketenagakerjaan * 2 / 3)), 0)),
    fmtRp(items.reduce((s, i) => s + i.bpjs_kesehatan, 0)),
    fmtRp(items.reduce((s, i) => s + (i.loan_deduction || 0), 0)),
    fmtRp(items.reduce((s, i) => s + (i.other_deduction || 0), 0)),
    "",
    fmtRp(totalPPh),
    fmtRp(totalDeductions),
    fmtRp(totalTHP),
  ];

  autoTable(doc, {
    startY: 24,
    head: [["No", "NIK", "Nama", "Bruto", "JHT (2%)", "JP (1%)", "BPJS Kes (1%)", "Pinjaman", "Pot. Lain", "Mode PPh21", "PPh 21", "Total Potongan", "Take Home Pay"]],
    body: [...deductionRows, deductionTotals],
    margin: { left: mx, right: mx },
    styles: { fontSize: 6.5, cellPadding: 1.8, lineWidth: 0.1, lineColor: [200, 200, 200] },
    headStyles: { fillColor: GREEN, textColor: WHITE, fontStyle: "bold", fontSize: 6.5, halign: "center", cellPadding: 2.5 },
    columnStyles: {
      0: { halign: "center", cellWidth: 8 },
      1: { cellWidth: 18 },
      2: { cellWidth: 32 },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
      8: { halign: "right" },
      9: { halign: "center", cellWidth: 22 },
      10: { halign: "right" },
      11: { halign: "right", fontStyle: "bold" },
      12: { halign: "right", fontStyle: "bold" },
    },
    alternateRowStyles: { fillColor: [248, 252, 248] },
    didParseCell(data) {
      if (data.row.index === deductionRows.length) {
        data.cell.styles.fillColor = LIGHT_GREEN;
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fontSize = 7;
      }
      // Highlight THP column
      if (data.column.index === 12 && data.row.index === deductionRows.length) {
        data.cell.styles.fillColor = GREEN;
        data.cell.styles.textColor = WHITE;
        data.cell.styles.fontSize = 7.5;
      }
    },
  });

  addFooter(doc, pw, ph, 3, periodLabel);

  // ===== PAGE 4: EMPLOYER CONTRIBUTIONS (BPJS) =====
  doc.addPage("a4", "landscape");
  addPageHeader(doc, pw, "KONTRIBUSI BPJS PERUSAHAAN", periodLabel, mx, rightEnd);

  const bpjsRows = items.map((item, idx) => {
    const totalEr = item.bpjs_kes_employer + item.bpjs_jht_employer + item.bpjs_jp_employer + item.bpjs_jkk_employer + item.bpjs_jkm_employer;
    return [
      String(idx + 1),
      item.nik || "-",
      item.employee_name || "-",
      item.departemen || "-",
      fmtRp(item.basic_salary),
      fmtRp(item.bpjs_kes_employer),
      fmtRp(item.bpjs_jht_employer),
      fmtRp(item.bpjs_jp_employer),
      fmtRp(item.bpjs_jkk_employer),
      fmtRp(item.bpjs_jkm_employer),
      fmtRp(totalEr),
    ];
  });

  const bpjsTotals = [
    "", "", "TOTAL", "",
    fmtRp(items.reduce((s, i) => s + i.basic_salary, 0)),
    fmtRp(items.reduce((s, i) => s + i.bpjs_kes_employer, 0)),
    fmtRp(items.reduce((s, i) => s + i.bpjs_jht_employer, 0)),
    fmtRp(items.reduce((s, i) => s + i.bpjs_jp_employer, 0)),
    fmtRp(items.reduce((s, i) => s + i.bpjs_jkk_employer, 0)),
    fmtRp(items.reduce((s, i) => s + i.bpjs_jkm_employer, 0)),
    fmtRp(totalEmployerBpjs),
  ];

  autoTable(doc, {
    startY: 24,
    head: [["No", "NIK", "Nama", "Departemen", "Gaji Pokok", "Kes (4%)", "JHT (3.7%)", "JP (2%)", "JKK (0.24%)", "JKM (0.3%)", "Total BPJS ER"]],
    body: [...bpjsRows, bpjsTotals],
    margin: { left: mx, right: mx },
    styles: { fontSize: 7, cellPadding: 2, lineWidth: 0.1, lineColor: [200, 200, 200] },
    headStyles: { fillColor: GREEN, textColor: WHITE, fontStyle: "bold", fontSize: 7, halign: "center", cellPadding: 2.5 },
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
      1: { cellWidth: 22 },
      2: { cellWidth: 38 },
      3: { cellWidth: 28 },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
      8: { halign: "right" },
      9: { halign: "right" },
      10: { halign: "right", fontStyle: "bold" },
    },
    alternateRowStyles: { fillColor: [248, 252, 248] },
    didParseCell(data) {
      if (data.row.index === bpjsRows.length) {
        data.cell.styles.fillColor = LIGHT_GREEN;
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fontSize = 7.5;
      }
    },
  });

  addFooter(doc, pw, ph, 4, periodLabel);

  // Save
  doc.save(`Laporan_Payroll_Detail_${MONTHS_ID[month - 1]}_${year}.pdf`);
}

function addPageHeader(doc: jsPDF, pw: number, title: string, period: string, mx: number, rightEnd: number) {
  // Green header bar
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, pw, 18, "F");

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...WHITE);
  doc.text(title, pw / 2, 8, { align: "center" });

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Periode: ${period}`, mx + 2, 15);
  doc.text("PT. KEMIKA KARYA PRATAMA", rightEnd - 2, 15, { align: "right" });

  // Reset text color
  doc.setTextColor(...DARK_TEXT);
}

function addFooter(doc: jsPDF, pw: number, ph: number, pageNum: number, period: string) {
  // Footer line
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.5);
  doc.line(8, ph - 10, pw - 8, ph - 10);

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY_TEXT);
  doc.text("Dokumen ini dicetak melalui sistem digital dan tidak memerlukan tanda tangan sebagai validasi.", 8, ph - 6);
  doc.text(`PT. Kemika Karya Pratama — Laporan Payroll ${period}`, pw / 2, ph - 6, { align: "center" });
  doc.text(`Halaman ${pageNum}`, pw - 8, ph - 6, { align: "right" });
}
