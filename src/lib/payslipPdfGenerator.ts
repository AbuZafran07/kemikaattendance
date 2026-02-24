import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const MONTHS = [
  { value: 1, label: "January" }, { value: 2, label: "February" }, { value: 3, label: "March" },
  { value: 4, label: "April" }, { value: 5, label: "May" }, { value: 6, label: "June" },
  { value: 7, label: "July" }, { value: 8, label: "August" }, { value: 9, label: "September" },
  { value: 10, label: "October" }, { value: 11, label: "November" }, { value: 12, label: "December" },
];

const GREEN = [0, 135, 81] as const;
const LIGHT_GREEN = [200, 230, 210] as const;
const HEADER_BG = [230, 245, 230] as const;

export const loadImageAsBase64 = (src: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width; canvas.height = img.height;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = src;
  });

function fmtNum(amount: number): string {
  if (!amount || amount === 0) return "-";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function calculateServicePeriod(joinDate: string): string {
  if (!joinDate) return "-";
  const start = new Date(joinDate);
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  let days = now.getDate() - start.getDate();
  if (days < 0) { months--; days += 30; }
  if (months < 0) { years--; months += 12; }
  return `${years} Tahun, ${months} Bulan, ${days} Hari`;
}

export interface PayslipData {
  // Employee info
  employee_name: string;
  nik: string;
  jabatan: string;
  departemen: string;
  ptkp_status: string;
  join_date?: string;
  // Income
  basic_salary: number;
  allowance: number; // total allowance field
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
  // Deductions
  bpjs_ketenagakerjaan: number; // JHT + JP employee
  bpjs_kesehatan: number;
  loan_deduction: number;
  other_deduction: number;
  pph21_monthly: number;
  // Totals
  bruto_income: number;
  netto_income: number;
  take_home_pay: number;
  // Employer contributions
  bpjs_jht_employer: number;
  bpjs_jp_employer: number;
  bpjs_jkk_employer: number;
  bpjs_jkm_employer: number;
  bpjs_kes_employer: number;
  // Period
  month: number;
  year: number;
}

export async function generatePayslipPDF(data: PayslipData, logoSrc: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth(); // ~210
  const mx = 10; // margin x
  const rightEnd = pw - mx;
  const midX = pw / 2;

  // ===== HEADER =====
  // Logo on the left
  try {
    const logoBase64 = await loadImageAsBase64(logoSrc);
    doc.addImage(logoBase64, "PNG", mx, 8, 40, 18);
  } catch {}

  // Employee info on the right
  const infoX = 115;
  const valX = 158;
  let hy = 12;
  doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(0);
  const empInfo = [
    ["Employee ID", data.nik || "-"],
    ["Employee Name", data.employee_name || "-"],
    ["Job Level", data.jabatan || "-"],
    ["Organization", data.departemen || "-"],
  ];
  for (const [label, val] of empInfo) {
    doc.setFont("helvetica", "bold");
    doc.text(label, infoX, hy);
    doc.text(":", valX - 2, hy);
    doc.setFont("helvetica", "normal");
    doc.text(val, valX + 1, hy);
    hy += 5;
  }

  // ===== SALARY SLIP line =====
  let y = 32;
  doc.setDrawColor(...GREEN); doc.setLineWidth(0.8);
  doc.line(mx, y, rightEnd, y);

  y += 6;
  doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(0);
  doc.text("SALARY SLIP", mx, y);
  doc.text(":", mx + 28, y);
  const periodLabel = `${MONTHS[data.month - 1]?.label || ""} - ${data.year}`;
  doc.text(periodLabel, rightEnd, y, { align: "right" });

  y += 2;
  doc.setDrawColor(...GREEN); doc.setLineWidth(0.3);
  doc.line(mx, y, rightEnd, y);

  // ===== INCOME & DEDUCTION side by side =====
  y += 2;
  const colLeft = mx;
  const colMid = midX + 2;
  const leftAmtX = midX - 3;
  const rightAmtX = rightEnd;

  // Calculate tunjangan kehadiran (attendance allowance)
  const fixedTotal = (data.tunjangan_komunikasi || 0) + (data.tunjangan_jabatan || 0) + (data.tunjangan_operasional || 0);
  const incidentalTotal = (data.tunjangan_kesehatan || 0) + (data.bonus_tahunan || 0) + (data.thr || 0)
    + (data.insentif_kinerja || 0) + (data.bonus_lainnya || 0) + (data.pengembalian_employee || 0) + (data.insentif_penjualan || 0);
  const tunjanganKehadiran = Math.max(0, data.allowance - fixedTotal - incidentalTotal);

  // JHT Employee = 2% of basic salary, JP Employee = 1% of basic salary
  // bpjs_ketenagakerjaan = JHT + JP combined
  const jhtEmployee = Math.round(data.bpjs_ketenagakerjaan * 2 / 3); // approx 2% portion
  const jpEmployee = data.bpjs_ketenagakerjaan - jhtEmployee; // approx 1% portion

  // Income items
  const incomeItems: [string, number][] = [
    ["Basic Salary", data.basic_salary],
    ["Tunjangan Kehadiran", tunjanganKehadiran],
    ["Tunjangan Operasional", data.tunjangan_operasional || 0],
    ["Tunjangan Jabatan", data.tunjangan_jabatan || 0],
    ["Tunjangan Komunikasi", data.tunjangan_komunikasi || 0],
    ["Tunjangan Kesehatan", data.tunjangan_kesehatan || 0],
    ["THR", data.thr || 0],
    ["Overtime", data.overtime_total || 0],
    ["Insentif Kinerja", data.insentif_kinerja || 0],
    ["Insentif Penjualan", data.insentif_penjualan || 0],
    ["Bonus Tahunan", data.bonus_tahunan || 0],
    ["Bonus Lainnya", data.bonus_lainnya || 0],
    ["Pengembalian Employee", data.pengembalian_employee || 0],
  ];

  // Deduction items
  const deductionItems: [string, number][] = [
    ["JHT Employee", jhtEmployee],
    ["JP Employee", jpEmployee],
    ["BPJS Kesehatan Employee", data.bpjs_kesehatan],
    ["Pinjaman Karyawan", data.loan_deduction || 0],
    ["Pengembalian Company", data.other_deduction || 0],
    ["PPH21", data.pph21_monthly],
  ];

  // Section headers with green background
  doc.setFillColor(...HEADER_BG);
  doc.rect(colLeft, y, midX - mx - 1, 6, "F");
  doc.rect(colMid - 1, y, midX - mx, 6, "F");

  doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(0);
  doc.text("INCOME", colLeft + (midX - mx) / 2, y + 4, { align: "center" });
  doc.text("DEDUCTION", colMid + (midX - mx) / 2 - 1, y + 4, { align: "center" });
  y += 7;

  // Draw thin line under headers
  doc.setDrawColor(...GREEN); doc.setLineWidth(0.2);
  doc.line(colLeft, y, rightEnd, y);
  y += 1;

  const rowH = 4.5;
  doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(0);

  const maxRows = Math.max(incomeItems.length, deductionItems.length);
  const startY = y;

  for (let i = 0; i < maxRows; i++) {
    const ry = startY + i * rowH;

    // Alternate row bg
    if (i % 2 === 0) {
      doc.setFillColor(245, 250, 245);
      doc.rect(colLeft, ry - 0.5, midX - mx - 1, rowH, "F");
      doc.rect(colMid - 1, ry - 0.5, midX - mx, rowH, "F");
    }

    // Income column
    if (i < incomeItems.length) {
      const [label, val] = incomeItems[i];
      doc.setFont("helvetica", "normal");
      doc.text(label, colLeft + 1, ry + 3);
      doc.text("Rp", colLeft + 62, ry + 3);
      doc.text(fmtNum(val), leftAmtX, ry + 3, { align: "right" });
    }

    // Deduction column
    if (i < deductionItems.length) {
      const [label, val] = deductionItems[i];
      doc.setFont("helvetica", "normal");
      doc.text(label, colMid + 1, ry + 3);
      doc.text("Rp", colMid + 62, ry + 3);
      doc.text(fmtNum(val), rightAmtX, ry + 3, { align: "right" });
    }
  }

  y = startY + maxRows * rowH + 1;

  // ===== Total Income & Total Deduction =====
  doc.setDrawColor(...GREEN); doc.setLineWidth(0.3);
  doc.line(colLeft, y, rightEnd, y);
  y += 1;

  const totalIncome = data.basic_salary + tunjanganKehadiran + (data.tunjangan_operasional || 0)
    + (data.tunjangan_jabatan || 0) + (data.tunjangan_komunikasi || 0) + (data.tunjangan_kesehatan || 0)
    + (data.thr || 0) + (data.overtime_total || 0) + (data.insentif_kinerja || 0)
    + (data.insentif_penjualan || 0) + (data.bonus_tahunan || 0) + (data.bonus_lainnya || 0)
    + (data.pengembalian_employee || 0);

  const totalDeduction = data.bpjs_ketenagakerjaan + data.bpjs_kesehatan
    + (data.loan_deduction || 0) + (data.other_deduction || 0) + data.pph21_monthly;

  doc.setFillColor(...HEADER_BG);
  doc.rect(colLeft, y, rightEnd - colLeft, 6, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
  doc.text("Total Income", colLeft + 1, y + 4);
  doc.text("Rp", colLeft + 62, y + 4);
  doc.text(fmtNum(totalIncome), leftAmtX, y + 4, { align: "right" });
  doc.text("Total Deduction", colMid + 1, y + 4);
  doc.text("Rp", colMid + 62, y + 4);
  doc.text(fmtNum(totalDeduction), rightAmtX, y + 4, { align: "right" });
  y += 7;

  // ===== Take Home Pay =====
  doc.setFillColor(...GREEN);
  doc.rect(colLeft, y, rightEnd - colLeft, 7, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text("Take Home Pay", colMid - 10, y + 5);
  doc.text("Rp", colMid + 40, y + 5);
  doc.text(fmtNum(data.take_home_pay), rightAmtX, y + 5, { align: "right" });
  doc.setTextColor(0);
  y += 10;

  // ===== NEUTRAL section =====
  doc.setDrawColor(...GREEN); doc.setLineWidth(0.3);
  doc.line(colLeft, y, rightEnd, y);
  y += 1;

  doc.setFillColor(...HEADER_BG);
  doc.rect(colLeft, y, rightEnd - colLeft, 5, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(9);
  doc.text("NEUTRAL", pw / 2, y + 3.5, { align: "center" });
  y += 6;

  doc.setDrawColor(...GREEN); doc.setLineWidth(0.2);
  doc.line(colLeft, y, rightEnd, y);
  y += 1;

  // Neutral left: employer BPJS
  const neutralLeft: [string, number][] = [
    ["JKK Company", data.bpjs_jkk_employer],
    ["JKM Company", data.bpjs_jkm_employer],
    ["JHT Company", data.bpjs_jht_employer],
    ["JP Company", data.bpjs_jp_employer],
    ["BPJS Kesehatan Company", data.bpjs_kes_employer],
  ];

  // Neutral right: employee info
  const servicePeriod = data.join_date ? calculateServicePeriod(data.join_date) : "-";
  const neutralRight: [string, string][] = [
    ["Tax Status", data.ptkp_status || "-"],
    ["NPWP Number", "-"],
    ["Service Period", servicePeriod],
    ["Contract Type", "Permanent Employee"],
  ];

  doc.setFontSize(8); doc.setFont("helvetica", "normal");
  const neutralRows = Math.max(neutralLeft.length, neutralRight.length);
  const neutralStartY = y;

  for (let i = 0; i < neutralRows; i++) {
    const ry = neutralStartY + i * rowH;

    if (i % 2 === 0) {
      doc.setFillColor(245, 250, 245);
      doc.rect(colLeft, ry - 0.5, rightEnd - colLeft, rowH, "F");
    }

    if (i < neutralLeft.length) {
      const [label, val] = neutralLeft[i];
      doc.text(label, colLeft + 1, ry + 3);
      doc.text("Rp", colLeft + 45, ry + 3);
      doc.text(fmtNum(val), colLeft + 90, ry + 3, { align: "right" });
    }

    if (i < neutralRight.length) {
      const [label, val] = neutralRight[i];
      doc.text(label, colMid + 5, ry + 3);
      doc.text(":", colMid + 40, ry + 3);
      doc.text(val, colMid + 43, ry + 3);
    }
  }

  y = neutralStartY + neutralRows * rowH + 2;

  // ===== FOOTER =====
  doc.setDrawColor(...GREEN); doc.setLineWidth(0.3);
  doc.line(colLeft, y, rightEnd, y);
  y += 3;

  doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.setTextColor(80);

  // Left: Bank info placeholder
  doc.text("Bank Name", colLeft + 1, y + 1);
  doc.text(": -", colLeft + 28, y + 1);
  doc.text("Account Number", colLeft + 1, y + 5);
  doc.text(": -", colLeft + 28, y + 5);
  doc.text("Account Name", colLeft + 1, y + 9);
  doc.text(`: ${data.employee_name || "-"}`, colLeft + 28, y + 9);

  // Right: Notes
  doc.setFont("helvetica", "bold");
  doc.text("Notes :", colMid + 5, y + 1);
  doc.setFont("helvetica", "normal");
  const noteLines = doc.splitTextToSize(
    "Slip Gaji ini dicetak melalui proses digitalisasi dan tidak memerlukan tanda tangan perusahaan sebagai bentuk validasi",
    rightEnd - colMid - 10
  );
  doc.text(noteLines, colMid + 5, y + 5);

  doc.save(`Slip_Gaji_${(data.employee_name || "Employee").replace(/\s+/g, "_")}_${MONTHS[data.month - 1]?.label || ""}_${data.year}.pdf`);
}
