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
  voucher_no: string;
  issued_at: Date;
  employee_name: string;
  nik: string;
  jabatan?: string;
  departemen?: string;
  bank_name?: string;
  bank_account_number?: string;
  destination: string;
  purpose: string;
  start_date: string;
  end_date: string;
  total_days: number;
  effective_days: number;
  per_day_travel: number;
  per_day_attendance_deduction: number;
  total_amount: number;
  splits: Array<{ period_month: number; period_year: number; days: number; amount: number }>;
}

async function renderVoucherPage(doc: jsPDF, data: TravelVoucherData, logoBase64: string | null) {
  const pw = doc.internal.pageSize.getWidth();
  const mx = 14;
  const rightEnd = pw - mx;

  // ===== HEADER =====
  if (logoBase64) {
    try { doc.addImage(logoBase64, "PNG", mx, 10, 38, 17); } catch {}
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(GREEN[0], GREEN[1], GREEN[2]);
  doc.text("VOUCHER TRANSFER TUNJANGAN", rightEnd, 14, { align: "right" });
  doc.text("PERJALANAN DINAS", rightEnd, 20, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);
  doc.text(`No. Voucher: ${data.voucher_no}`, rightEnd, 25, { align: "right" });
  doc.text(
    `Tanggal Terbit: ${data.issued_at.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}`,
    rightEnd, 29.5, { align: "right" }
  );

  doc.setDrawColor(GREEN[0], GREEN[1], GREEN[2]);
  doc.setLineWidth(0.7);
  doc.line(mx, 34, rightEnd, 34);

  // ===== INFO KARYAWAN =====
  let y = 40;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0);
  doc.text("DATA KARYAWAN", mx, y);
  y += 3;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);
  doc.line(mx, y, rightEnd, y);
  y += 5;

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
  doc.setFontSize(9);
  for (const [l1, v1, l2, v2] of rows) {
    doc.setFont("helvetica", "bold"); doc.text(l1, labelX, y); doc.text(":", colonX, y);
    doc.setFont("helvetica", "normal"); doc.text(String(v1), valX, y);
    doc.setFont("helvetica", "bold"); doc.text(l2, rLabelX, y); doc.text(":", rColonX, y);
    doc.setFont("helvetica", "normal"); doc.text(String(v2), rValX, y);
    y += 5.5;
  }

  // ===== DETAIL PERJALANAN =====
  y += 3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("DETAIL PERJALANAN DINAS", mx, y);
  y += 3;
  doc.line(mx, y, rightEnd, y);
  y += 5;

  const trips: Array<[string, string]> = [
    ["Tujuan", data.destination || "-"],
    ["Keperluan", data.purpose || "-"],
    ["Tanggal Mulai", fmtDateID(data.start_date)],
    ["Tanggal Selesai", fmtDateID(data.end_date)],
    ["Total Hari Kalender", `${data.total_days} hari`],
    ["Hari Kerja Efektif", `${data.effective_days} hari (di luar Sabtu/Minggu & libur nasional)`],
  ];
  doc.setFontSize(9);
  for (const [l, v] of trips) {
    doc.setFont("helvetica", "bold"); doc.text(l, labelX, y); doc.text(":", colonX, y);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(String(v), rightEnd - valX);
    doc.text(lines, valX, y);
    y += 5.5 * (Array.isArray(lines) ? lines.length : 1);
  }

  // ===== RINCIAN =====
  y += 3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("RINCIAN PERHITUNGAN TUNJANGAN", mx, y);
  y += 3;
  doc.line(mx, y, rightEnd, y);
  y += 2;

  doc.setFillColor(HEADER_BG[0], HEADER_BG[1], HEADER_BG[2]);
  doc.rect(mx, y, rightEnd - mx, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text("Periode Payroll", mx + 2, y + 4);
  doc.text("Hari Kerja Efektif", mx + 60, y + 4);
  doc.text("Subtotal", rightEnd - 2, y + 4, { align: "right" });
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  for (const s of data.splits) {
    const periodLabel = `${MONTHS_ID[s.period_month - 1]} ${s.period_year}`;
    doc.text(periodLabel, mx + 2, y + 4);
    doc.text(`${s.days} hari`, mx + 60, y + 4);
    doc.text(fmtIDR(s.amount), rightEnd - 2, y + 4, { align: "right" });
    y += 5.5;
    doc.setDrawColor(220, 220, 220);
    doc.line(mx, y, rightEnd, y);
  }

  // Total
  y += 1;
  doc.setFillColor(GREEN[0], GREEN[1], GREEN[2]);
  doc.rect(mx, y, rightEnd - mx, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text("TOTAL TRANSFER", mx + 2, y + 5.5);
  doc.text(fmtIDR(data.total_amount), rightEnd - 2, y + 5.5, { align: "right" });
  doc.setTextColor(0, 0, 0);
  y += 12;


  // Instruksi transfer
  doc.setDrawColor(GREEN[0], GREEN[1], GREEN[2]);
  doc.setLineWidth(0.4);
  doc.line(mx, y, rightEnd, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0);
  doc.text("INSTRUKSI TRANSFER", mx, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const instr =
    `Mohon dilakukan transfer dana sebesar ${fmtIDR(data.total_amount)} ke rekening karyawan di atas ` +
    `sebagai pembayaran di muka tunjangan perjalanan dinas. Tunjangan ini telah disetujui dan akan ` +
    `dicatat otomatis pada periode payroll terkait.`;
  const iLines = doc.splitTextToSize(instr, rightEnd - mx);
  doc.text(iLines, mx, y);
  y += 5 * (Array.isArray(iLines) ? iLines.length : 1) + 4;

  // Footer note
  doc.setFillColor(245, 250, 245);
  doc.rect(mx, y, rightEnd - mx, 14, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(GREEN[0], GREEN[1], GREEN[2]);
  doc.text("Catatan:", mx + 2, y + 4.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  const footer =
    "Dokumen ini diterbitkan secara digital melalui sistem dan dinyatakan SAH tanpa tanda tangan & cap basah. " +
    "Voucher ini menjadi dasar pencairan dana perjalanan dinas yang telah disetujui.";
  const fLines = doc.splitTextToSize(footer, rightEnd - mx - 4);
  doc.text(fLines, mx + 2, y + 9);
}

export async function generateBusinessTravelVoucherPDF(data: TravelVoucherData, logoSrc: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let logoBase64: string | null = null;
  try { logoBase64 = await loadImageAsBase64(logoSrc); } catch {}
  await renderVoucherPage(doc, data, logoBase64);
  const safeName = (data.employee_name || "Karyawan").replace(/\s+/g, "_");
  doc.save(`Voucher_Perjadin_${safeName}_${data.voucher_no}.pdf`);
}

export async function generateBusinessTravelVoucherBatchPDF(
  items: TravelVoucherData[],
  logoSrc: string,
  fileName?: string,
) {
  if (items.length === 0) return;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  let logoBase64: string | null = null;
  try { logoBase64 = await loadImageAsBase64(logoSrc); } catch {}

  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const mx = 10;
  const rightEnd = pw - mx;
  const issued = new Date();

  const drawHeader = () => {
    if (logoBase64) {
      try { doc.addImage(logoBase64, "PNG", mx, 8, 34, 15); } catch {}
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(GREEN[0], GREEN[1], GREEN[2]);
    doc.text("DAFTAR TRANSFER TUNJANGAN PERJALANAN DINAS", rightEnd, 14, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(80, 80, 80);
    doc.text(
      `Tanggal Terbit: ${issued.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}`,
      rightEnd, 20, { align: "right" }
    );
    doc.text(`Jumlah Karyawan: ${items.length}`, rightEnd, 24.5, { align: "right" });
    doc.setDrawColor(GREEN[0], GREEN[1], GREEN[2]);
    doc.setLineWidth(0.7);
    doc.line(mx, 28, rightEnd, 28);
  };

  // Column layout (landscape A4 = 297mm wide, usable = 277mm)
  const cols = [
    { key: "no", label: "No", w: 8, align: "center" as const },
    { key: "name", label: "Nama Karyawan", w: 42, align: "left" as const },
    { key: "nik", label: "NIK", w: 22, align: "left" as const },
    { key: "bank", label: "Bank", w: 20, align: "left" as const },
    { key: "rek", label: "No. Rekening", w: 30, align: "left" as const },
    { key: "dest", label: "Tujuan", w: 38, align: "left" as const },
    { key: "period", label: "Tanggal Dinas", w: 40, align: "left" as const },
    { key: "days", label: "Hari Efektif", w: 16, align: "center" as const },
    { key: "amount", label: "Nominal Transfer", w: 61, align: "right" as const },

  ];

  const drawTableHeader = (y: number) => {
    doc.setFillColor(HEADER_BG[0], HEADER_BG[1], HEADER_BG[2]);
    doc.rect(mx, y, rightEnd - mx, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    let x = mx;
    for (const c of cols) {
      const tx = c.align === "right" ? x + c.w - 1.5 : c.align === "center" ? x + c.w / 2 : x + 1.5;
      doc.text(c.label, tx, y + 5, { align: c.align });
      x += c.w;
    }
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.2);
    doc.line(mx, y + 8, rightEnd, y + 8);
    return y + 8;
  };

  drawHeader();
  let y = 32;
  y = drawTableHeader(y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  let total = 0;
  let no = 1;
  const rowH = 7;

  for (const it of items) {
    // Page break
    if (y + rowH > ph - 25) {
      doc.addPage();
      drawHeader();
      y = 32;
      y = drawTableHeader(y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
    }

    const period = `${fmtDateID(it.start_date)} - ${fmtDateID(it.end_date)}`;
    const values: Record<string, string> = {
      no: String(no),
      name: it.employee_name,
      nik: it.nik,
      bank: it.bank_name || "-",
      rek: it.bank_account_number || "-",
      dest: it.destination,
      period,
      days: `${it.effective_days}`,
      amount: fmtIDR(it.total_amount),
    };


    let x = mx;
    for (const c of cols) {
      const raw = values[c.key] || "";
      const maxW = c.w - 3;
      const txt = doc.splitTextToSize(raw, maxW)[0]; // single line clip
      const tx = c.align === "right" ? x + c.w - 1.5 : c.align === "center" ? x + c.w / 2 : x + 1.5;
      doc.text(txt, tx, y + 5, { align: c.align });
      x += c.w;
    }
    doc.setDrawColor(230, 230, 230);
    doc.line(mx, y + rowH, rightEnd, y + rowH);
    y += rowH;
    total += it.total_amount;
    no += 1;
  }

  // Total row
  if (y + 10 > ph - 25) {
    doc.addPage();
    drawHeader();
    y = 32;
  }
  doc.setFillColor(GREEN[0], GREEN[1], GREEN[2]);
  doc.rect(mx, y, rightEnd - mx, 9, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text("TOTAL TRANSFER", mx + 2, y + 6);
  doc.text(fmtIDR(total), rightEnd - 2, y + 6, { align: "right" });
  doc.setTextColor(0, 0, 0);
  y += 13;

  const ensureSpace = (need: number) => {
    if (y + need > ph - 12) {
      doc.addPage();
      drawHeader();
      y = 32;
    }
  };


  // ===== INSTRUKSI TRANSFER (per penerima) =====
  ensureSpace(14);
  doc.setDrawColor(GREEN[0], GREEN[1], GREEN[2]);
  doc.setLineWidth(0.5);
  doc.line(mx, y, rightEnd, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0);
  doc.text("INSTRUKSI TRANSFER", mx, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  const intro =
    "Mohon dilakukan transfer dana sebagai pembayaran di muka tunjangan perjalanan dinas ke masing-masing rekening karyawan berikut. " +
    "Tunjangan ini telah disetujui dan akan dicatat otomatis pada periode payroll terkait.";
  const introLines = doc.splitTextToSize(intro, rightEnd - mx);
  ensureSpace(4.5 * (Array.isArray(introLines) ? introLines.length : 1) + 4);
  doc.text(introLines, mx, y);
  y += 4.5 * (Array.isArray(introLines) ? introLines.length : 1) + 2;

  // Per-row recipient lines
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  let rNo = 1;
  for (const it of items) {
    ensureSpace(5);
    const line =
      `${rNo}. ${it.employee_name} - ${it.bank_name || "-"} ${it.bank_account_number || "-"}  >>  ${fmtIDR(it.total_amount)}`;
    const wrapped = doc.splitTextToSize(line, rightEnd - mx - 2);
    doc.text(wrapped, mx + 2, y + 3.5);
    y += 4.5 * (Array.isArray(wrapped) ? wrapped.length : 1) + 1;
    rNo += 1;
  }
  y += 3;

  // Footer note
  ensureSpace(16);
  doc.setFillColor(245, 250, 245);
  doc.rect(mx, y, rightEnd - mx, 14, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(GREEN[0], GREEN[1], GREEN[2]);
  doc.text("Catatan:", mx + 2, y + 4.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  const footer =
    "Dokumen ini diterbitkan secara digital melalui sistem dan dinyatakan SAH tanpa tanda tangan & cap basah. " +
    "Daftar ini menjadi dasar pencairan dana perjalanan dinas yang telah disetujui untuk seluruh karyawan di atas.";
  const fLines = doc.splitTextToSize(footer, rightEnd - mx - 4);
  doc.text(fLines, mx + 2, y + 9);

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(fileName || `Daftar_Transfer_Perjadin_${items.length}_karyawan_${stamp}.pdf`);
}
