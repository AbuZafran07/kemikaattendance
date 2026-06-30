import jsPDF from "jspdf";
import { loadImageAsBase64 } from "@/lib/payslipPdfGenerator";

const GREEN = [0, 135, 81] as const;
const HEADER_BG = [230, 245, 230] as const;

const MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const fmtIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n || 0);

const fmtDateID = (d: string) => {
  const [y, m, dd] = d.split("-").map(Number);
  return `${dd} ${MONTHS_ID[m - 1]} ${y}`;
};

export interface TravelVoucherData {
  // Voucher meta
  voucher_no: string;
  issued_at: Date;
  // Employee
  employee_name: string;
  nik: string;
  jabatan?: string;
  departemen?: string;
  bank_name?: string;
  bank_account_number?: string;
  // Trip
  destination: string;
  purpose: string;
  start_date: string; // yyyy-MM-dd
  end_date: string;   // yyyy-MM-dd
  total_days: number;          // hari kalender
  effective_days: number;      // hari kerja efektif
  per_day_travel: number;
  per_day_attendance_deduction: number; // rata per-hari attendance allowance (dikurangkan)
  total_amount: number;
  splits: Array<{ period_month: number; period_year: number; days: number; amount: number }>;
}

export async function generateBusinessTravelVoucherPDF(data: TravelVoucherData, logoSrc: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const mx = 14;
  const rightEnd = pw - mx;

  // ===== HEADER =====
  try {
    const logoBase64 = await loadImageAsBase64(logoSrc);
    doc.addImage(logoBase64, "PNG", mx, 10, 38, 17);
  } catch {}

  doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.setTextColor(...GREEN);
  doc.text("VOUCHER TRANSFER TUNJANGAN", rightEnd, 14, { align: "right" });
  doc.text("PERJALANAN DINAS", rightEnd, 20, { align: "right" });
  doc.setFontSize(8.5); doc.setFont("helvetica", "normal"); doc.setTextColor(80);
  doc.text(`No. Voucher: ${data.voucher_no}`, rightEnd, 25, { align: "right" });
  doc.text(`Tanggal Terbit: ${data.issued_at.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}`, rightEnd, 29.5, { align: "right" });

  // Garis pemisah
  doc.setDrawColor(...GREEN); doc.setLineWidth(0.7);
  doc.line(mx, 34, rightEnd, 34);

  // ===== INFO KARYAWAN =====
  let y = 40;
  doc.setFontSize(9.5); doc.setFont("helvetica", "bold"); doc.setTextColor(0);
  doc.text("DATA KARYAWAN", mx, y);
  y += 4;
  doc.setDrawColor(180); doc.setLineWidth(0.2);
  doc.line(mx, y, rightEnd, y);
  y += 4;

  const labelX = mx;
  const colonX = mx + 38;
  const valX = mx + 41;
  const rLabelX = pw / 2 + 5;
  const rColonX = rLabelX + 35;
  const rValX = rColonX + 3;

  const rows: Array<[string, string, string, string]> = [
    ["Nama", data.employee_name || "-", "Departemen", data.departemen || "-"],
    ["NIK", data.nik || "-", "Jabatan", data.jabatan || "-"],
    ["Bank", data.bank_name || "-", "No. Rekening", data.bank_account_number || "-"],
  ];
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  for (const [l1, v1, l2, v2] of rows) {
    doc.setFont("helvetica", "bold"); doc.text(l1, labelX, y); doc.text(":", colonX, y);
    doc.setFont("helvetica", "normal"); doc.text(v1, valX, y);
    doc.setFont("helvetica", "bold"); doc.text(l2, rLabelX, y); doc.text(":", rColonX, y);
    doc.setFont("helvetica", "normal"); doc.text(v2, rValX, y);
    y += 5.5;
  }

  // ===== DETAIL PERJALANAN =====
  y += 3;
  doc.setFontSize(9.5); doc.setFont("helvetica", "bold");
  doc.text("DETAIL PERJALANAN DINAS", mx, y);
  y += 4;
  doc.line(mx, y, rightEnd, y);
  y += 4;

  const trips: Array<[string, string]> = [
    ["Tujuan", data.destination || "-"],
    ["Keperluan", data.purpose || "-"],
    ["Tanggal Mulai", fmtDateID(data.start_date)],
    ["Tanggal Selesai", fmtDateID(data.end_date)],
    ["Total Hari Kalender", `${data.total_days} hari`],
    ["Hari Kerja Efektif", `${data.effective_days} hari (di luar Sabtu/Minggu & libur nasional)`],
  ];
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  for (const [l, v] of trips) {
    doc.setFont("helvetica", "bold"); doc.text(l, labelX, y); doc.text(":", colonX, y);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(v, rightEnd - valX);
    doc.text(lines, valX, y);
    y += 5.5 * (Array.isArray(lines) ? lines.length : 1);
  }

  // ===== RINCIAN PERHITUNGAN =====
  y += 3;
  doc.setFontSize(9.5); doc.setFont("helvetica", "bold");
  doc.text("RINCIAN PERHITUNGAN TUNJANGAN", mx, y);
  y += 4;
  doc.line(mx, y, rightEnd, y);
  y += 2;

  // Header tabel
  doc.setFillColor(...HEADER_BG);
  doc.rect(mx, y, rightEnd - mx, 6, "F");
  doc.setFontSize(8.5); doc.setFont("helvetica", "bold"); doc.setTextColor(0);
  doc.text("Periode Payroll", mx + 2, y + 4);
  doc.text("Hari Kerja Efektif", mx + 60, y + 4);
  doc.text("Tarif Bersih/Hari", mx + 105, y + 4);
  doc.text("Subtotal", rightEnd - 2, y + 4, { align: "right" });
  y += 6;

  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
  const perDayNet = Math.max(0, data.per_day_travel - data.per_day_attendance_deduction);
  for (const s of data.splits) {
    const periodLabel = `${MONTHS_ID[s.period_month - 1]} ${s.period_year}`;
    doc.text(periodLabel, mx + 2, y + 4);
    doc.text(`${s.days} hari`, mx + 60, y + 4);
    doc.text(fmtIDR(perDayNet), mx + 105, y + 4);
    doc.text(fmtIDR(s.amount), rightEnd - 2, y + 4, { align: "right" });
    y += 5.5;
    doc.setDrawColor(220); doc.line(mx, y, rightEnd, y);
  }

  // Total
  y += 1;
  doc.setFillColor(...GREEN);
  doc.rect(mx, y, rightEnd - mx, 8, "F");
  doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(10.5);
  doc.text("TOTAL TRANSFER", mx + 2, y + 5.5);
  doc.text(fmtIDR(data.total_amount), rightEnd - 2, y + 5.5, { align: "right" });
  doc.setTextColor(0);
  y += 12;

  // ===== KETERANGAN PERHITUNGAN =====
  doc.setFontSize(8); doc.setFont("helvetica", "italic"); doc.setTextColor(80);
  const calcNote =
    `Formula: max(0, Tarif Dinas/Hari − Tunj. Kehadiran/Hari) × Hari Kerja Efektif. ` +
    `Tarif Dinas/Hari ${fmtIDR(data.per_day_travel)}, ` +
    `Tunj. Kehadiran/Hari rata-rata ${fmtIDR(data.per_day_attendance_deduction)}.`;
  const noteLines = doc.splitTextToSize(calcNote, rightEnd - mx);
  doc.text(noteLines, mx, y);
  y += 5 * (Array.isArray(noteLines) ? noteLines.length : 1) + 3;

  // ===== INSTRUKSI TRANSFER =====
  doc.setDrawColor(...GREEN); doc.setLineWidth(0.4);
  doc.line(mx, y, rightEnd, y);
  y += 5;

  doc.setFontSize(9.5); doc.setFont("helvetica", "bold"); doc.setTextColor(0);
  doc.text("INSTRUKSI TRANSFER", mx, y);
  y += 5;
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  const instr = [
    `Mohon dilakukan transfer dana sebesar ${fmtIDR(data.total_amount)} ke rekening karyawan di atas`,
    `sebagai pembayaran di muka tunjangan perjalanan dinas. Tunjangan ini telah disetujui dan akan`,
    `dicatat otomatis pada periode payroll terkait.`,
  ];
  for (const line of instr) {
    doc.text(line, mx, y);
    y += 5;
  }

  // ===== FOOTER NOTE =====
  y += 6;
  doc.setFillColor(245, 250, 245);
  doc.rect(mx, y, rightEnd - mx, 14, "F");
  doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(...GREEN);
  doc.text("Catatan:", mx + 2, y + 4.5);
  doc.setFont("helvetica", "normal"); doc.setTextColor(60);
  const footer =
    "Dokumen ini diterbitkan secara digital melalui sistem dan dinyatakan SAH tanpa tanda tangan & cap basah. " +
    "Voucher ini menjadi dasar pencairan dana perjalanan dinas yang telah disetujui.";
  const fLines = doc.splitTextToSize(footer, rightEnd - mx - 4);
  doc.text(fLines, mx + 2, y + 9);

  const safeName = (data.employee_name || "Karyawan").replace(/\s+/g, "_");
  doc.save(`Voucher_Perjadin_${safeName}_${data.voucher_no}.pdf`);
}
