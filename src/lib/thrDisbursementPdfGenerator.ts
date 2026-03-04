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

function terbilang(angka: number): string {
  const huruf = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
  let temp = "";
  angka = Math.round(angka);
  if (angka < 12) {
    temp = " " + huruf[angka];
  } else if (angka < 20) {
    temp = terbilang(angka - 10) + " Belas";
  } else if (angka < 100) {
    temp = terbilang(Math.floor(angka / 10)) + " Puluh" + terbilang(angka % 10);
  } else if (angka < 200) {
    temp = " Seratus" + terbilang(angka - 100);
  } else if (angka < 1000) {
    temp = terbilang(Math.floor(angka / 100)) + " Ratus" + terbilang(angka % 100);
  } else if (angka < 2000) {
    temp = " Seribu" + terbilang(angka - 1000);
  } else if (angka < 1000000) {
    temp = terbilang(Math.floor(angka / 1000)) + " Ribu" + terbilang(angka % 1000);
  } else if (angka < 1000000000) {
    temp = terbilang(Math.floor(angka / 1000000)) + " Juta" + terbilang(angka % 1000000);
  } else if (angka < 1000000000000) {
    temp = terbilang(Math.floor(angka / 1000000000)) + " Miliar" + terbilang(angka % 1000000000);
  } else if (angka < 1000000000000000) {
    temp = terbilang(Math.floor(angka / 1000000000000)) + " Triliun" + terbilang(angka % 1000000000000);
  }
  return temp.trim();
}

export interface ThrEmployee {
  employee_name: string;
  nik: string;
  jabatan: string;
  departemen: string;
  join_date: string;
  basic_salary: number;
  thr_amount: number;
  tenure_months: number;
  tenure_days: number;
  bank_name?: string;
  bank_account_number?: string;
}

export async function generateThrDisbursementPDF(
  employees: ThrEmployee[],
  month: number,
  year: number,
  idulFitriDate: string,
  idulFitriName: string,
  logoSrc: string,
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const mx = 15; // margin x
  const rightEnd = pw - mx;
  const contentWidth = pw - mx * 2;

  let logoBase64 = "";
  try { logoBase64 = await loadImageAsBase64(logoSrc); } catch {}

  const totalThr = employees.reduce((s, e) => s + e.thr_amount, 0);
  const today = new Date();
  const formattedToday = `${today.getDate()} ${MONTHS_ID[today.getMonth()]} ${today.getFullYear()}`;
  const periodLabel = `${MONTHS_ID[month - 1]} ${year}`;

  // ── HEADER ──
  let y = 15;

  // Company header bar
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, pw, 4, "F");

  if (logoBase64) {
    doc.addImage(logoBase64, "PNG", mx, y, 18, 18);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...DARK_TEXT);
  doc.text("PT. KEMIKA KARYA PRATAMA", mx + 22, y + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY_TEXT);
  doc.text("Jl. Raya Industri No. 123, Jakarta Selatan", mx + 22, y + 13);
  doc.text("Tel: (021) 123-4567 | Email: hrd@kemika.co.id", mx + 22, y + 17);

  y = 38;
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.8);
  doc.line(mx, y, rightEnd, y);

  // ── TITLE ──
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...DARK_GREEN);
  doc.text("PENGAJUAN PEMBAYARAN", pw / 2, y, { align: "center" });
  y += 7;
  doc.setFontSize(13);
  doc.text("TUNJANGAN HARI RAYA (THR)", pw / 2, y, { align: "center" });

  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRAY_TEXT);
  doc.text(`Periode: ${periodLabel}`, pw / 2, y + 3, { align: "center" });

  // ── INFO BOX ──
  y += 12;
  doc.setFillColor(...LIGHT_GREEN);
  doc.roundedRect(mx, y, contentWidth, 28, 2, 2, "F");
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.3);
  doc.roundedRect(mx, y, contentWidth, 28, 2, 2, "S");

  const infoX = mx + 5;
  const infoX2 = mx + 55;
  let iy = y + 6;
  doc.setFontSize(8);
  doc.setTextColor(...GRAY_TEXT);
  doc.text("Nomor Dokumen", infoX, iy);
  doc.setTextColor(...DARK_TEXT);
  doc.setFont("helvetica", "bold");
  doc.text(`: THR/${year}/${String(month).padStart(2, "0")}/001`, infoX2, iy);

  iy += 5;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY_TEXT);
  doc.text("Tanggal Pengajuan", infoX, iy);
  doc.setTextColor(...DARK_TEXT);
  doc.setFont("helvetica", "bold");
  doc.text(`: ${formattedToday}`, infoX2, iy);

  iy += 5;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY_TEXT);
  doc.text("Hari Raya Acuan", infoX, iy);
  doc.setTextColor(...DARK_TEXT);
  doc.setFont("helvetica", "bold");
  const refDateFormatted = (() => {
    const d = new Date(idulFitriDate);
    return `${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
  })();
  doc.text(`: ${idulFitriName} (${refDateFormatted})`, infoX2, iy);

  iy += 5;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY_TEXT);
  doc.text("Dasar Perhitungan", infoX, iy);
  doc.setTextColor(...DARK_TEXT);
  doc.setFont("helvetica", "bold");
  doc.text(": Permenaker No. 6 Tahun 2016 — Basis Gaji Pokok", infoX2, iy);

  y += 32;

  // ── TABLE ──
  const sortedEmployees = [...employees].sort((a, b) => a.departemen.localeCompare(b.departemen) || a.employee_name.localeCompare(b.employee_name));

  const tableBody = sortedEmployees.map((emp, idx) => {
    const totalFraction = emp.tenure_months + (emp.tenure_days || 0) / 30;
    const tenureLabel = totalFraction >= 12
      ? `${Math.floor(emp.tenure_months / 12)} thn ${emp.tenure_months % 12} bln`
      : `${emp.tenure_months} bln ${emp.tenure_days || 0} hr`;
    const proportion = totalFraction >= 12 ? "1/1" : `${totalFraction.toFixed(2)}/12`;
    return [
      String(idx + 1),
      emp.employee_name,
      emp.nik,
      emp.departemen,
      tenureLabel,
      fmtRp(emp.basic_salary),
      proportion,
      fmtRp(emp.thr_amount),
      emp.bank_name || "-",
      emp.bank_account_number || "-",
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [[
      "No", "Nama Karyawan", "NIK", "Departemen",
      "Masa Kerja", "Gaji Pokok", "Proporsi", "Nominal THR (Rp)",
      "Bank", "No. Rekening",
    ]],
    body: tableBody,
    foot: [[
      { content: "", colSpan: 7, styles: { halign: "right" as const, fontStyle: "bold" as const } },
      { content: `TOTAL: Rp ${fmtRp(totalThr)}`, styles: { halign: "right" as const, fontStyle: "bold" as const, fillColor: LIGHT_GREEN } },
      { content: "", colSpan: 2 },
    ]],
    theme: "grid",
    headStyles: {
      fillColor: GREEN,
      textColor: WHITE,
      fontSize: 7,
      fontStyle: "bold",
      halign: "center",
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: 7,
      textColor: DARK_TEXT,
      cellPadding: 1.5,
    },
    footStyles: {
      fillColor: LIGHT_GREEN,
      textColor: DARK_GREEN,
      fontSize: 8,
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 7 },
      1: { cellWidth: 28 },
      2: { cellWidth: 16, halign: "center" },
      3: { cellWidth: 20 },
      4: { halign: "center", cellWidth: 16 },
      5: { halign: "right", cellWidth: 20 },
      6: { halign: "center", cellWidth: 13 },
      7: { halign: "right", cellWidth: 22 },
      8: { cellWidth: 18 },
      9: { cellWidth: 20 },
    },
    margin: { left: mx, right: mx },
    didDrawPage: (data) => {
      // Footer on each page
      doc.setFillColor(...GREEN);
      doc.rect(0, ph - 4, pw, 4, "F");
      doc.setFontSize(6);
      doc.setTextColor(...GRAY_TEXT);
      doc.text(`Dokumen THR — ${periodLabel} | Dicetak: ${formattedToday}`, mx, ph - 6);
      doc.text(`Hal. ${doc.getCurrentPageInfo().pageNumber}`, rightEnd, ph - 6, { align: "right" });
    },
  });

  // ── AFTER TABLE: Summary & Terbilang ──
  let finalY = (doc as any).lastAutoTable?.finalY || y + 50;

  // Check if we need a new page for the rest
  if (finalY > ph - 100) {
    doc.addPage();
    finalY = 20;
    doc.setFillColor(...GREEN);
    doc.rect(0, 0, pw, 4, "F");
  }

  finalY += 5;

  // Terbilang box
  doc.setFillColor(250, 250, 245);
  doc.roundedRect(mx, finalY, contentWidth, 16, 2, 2, "F");
  doc.setDrawColor(200, 200, 200);
  doc.roundedRect(mx, finalY, contentWidth, 16, 2, 2, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...DARK_TEXT);
  doc.text("Total Pengajuan THR:", mx + 4, finalY + 5);
  doc.setFontSize(11);
  doc.setTextColor(...DARK_GREEN);
  doc.text(`Rp ${fmtRp(totalThr)}`, mx + 4, finalY + 11);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(...GRAY_TEXT);
  const terbilangText = `Terbilang: ${terbilang(totalThr)} Rupiah`;
  doc.text(terbilangText, mx + 50, finalY + 11, { maxWidth: contentWidth - 55 });

  finalY += 20;

  // Summary info
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY_TEXT);
  const fullTimers = employees.filter(e => (e.tenure_months + (e.tenure_days || 0) / 30) >= 12).length;
  const prorated = employees.filter(e => (e.tenure_months + (e.tenure_days || 0) / 30) < 12).length;
  doc.text(`Jumlah Penerima: ${employees.length} karyawan (${fullTimers} penuh, ${prorated} proporsional)`, mx, finalY);

  // ── SIGNATURE SECTION ──
  finalY += 15;

  const sigWidth = 55;
  const sigGap = (contentWidth - sigWidth * 3) / 2;

  const sigPositions = [
    { x: mx, title: "Diajukan oleh:", role: "HR / Payroll" },
    { x: mx + sigWidth + sigGap, title: "Disetujui oleh:", role: "Finance Manager" },
    { x: mx + (sigWidth + sigGap) * 2, title: "Disetujui oleh:", role: "Direktur" },
  ];

  for (const sig of sigPositions) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRAY_TEXT);
    doc.text(sig.title, sig.x, finalY);

    // Signature line
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.line(sig.x, finalY + 25, sig.x + sigWidth, finalY + 25);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...DARK_TEXT);
    doc.text("(                              )", sig.x + sigWidth / 2, finalY + 30, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...GRAY_TEXT);
    doc.text(sig.role, sig.x + sigWidth / 2, finalY + 35, { align: "center" });
  }

  // ── Footer bar ──
  doc.setFillColor(...GREEN);
  doc.rect(0, ph - 4, pw, 4, "F");
  doc.setFontSize(6);
  doc.setTextColor(...GRAY_TEXT);
  doc.text(`Dokumen THR — ${periodLabel} | Dicetak: ${formattedToday}`, mx, ph - 6);
  doc.text(`Hal. ${doc.getCurrentPageInfo().pageNumber}`, rightEnd, ph - 6, { align: "right" });

  // ── Save ──
  doc.save(`Pengajuan_THR_${MONTHS_ID[month - 1]}_${year}.pdf`);
}
