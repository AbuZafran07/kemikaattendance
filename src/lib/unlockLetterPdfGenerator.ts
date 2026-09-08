import jsPDF from "jspdf";
import { loadImageAsBase64 } from "@/lib/payslipPdfGenerator";

const GREEN = [0, 135, 81] as const;

export interface UnlockLetterData {
  letter_number: string;
  employee_name: string;
  nik?: string;
  jabatan?: string;
  departemen?: string;
  statement_text: string;
  employee_signature_data: string;
  employee_signed_at: string;
  hr_signature_data?: string | null;
  hr_signed_by_name?: string | null;
  hr_signed_at?: string | null;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export async function generateUnlockLetterPDF(data: UnlockLetterData, logoSrc: string): Promise<Blob> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const mx = 15;
  const rightEnd = pw - mx;

  try {
    const logoBase64 = await loadImageAsBase64(logoSrc);
    doc.addImage(logoBase64, "PNG", mx, 12, 35, 16);
  } catch {
    /* logo optional */
  }

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...GREEN);
  doc.text("SURAT PERMOHONAN PEMBUKAAN LOCK ABSENSI", pw / 2, 20, { align: "center" });

  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.setFont("helvetica", "normal");
  doc.text(`Nomor: ${data.letter_number}`, pw / 2, 26, { align: "center" });

  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.5);
  doc.line(mx, 34, rightEnd, 34);

  let y = 44;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);

  const infoRows: [string, string][] = [
    ["Nama", data.employee_name || "-"],
    ["NIK", data.nik || "-"],
    ["Jabatan", data.jabatan || "-"],
    ["Departemen", data.departemen || "-"],
  ];
  for (const [label, value] of infoRows) {
    doc.setFont("helvetica", "bold");
    doc.text(label, mx, y);
    doc.text(":", mx + 32, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, mx + 36, y);
    y += 6;
  }

  y += 6;
  doc.setFont("helvetica", "normal");
  const statementLines = doc.splitTextToSize(data.statement_text, rightEnd - mx);
  doc.text(statementLines, mx, y);
  y += statementLines.length * 5.5 + 12;

  const sigBoxWidth = (rightEnd - mx - 10) / 2;

  doc.setFont("helvetica", "bold");
  doc.text("Karyawan,", mx, y);
  doc.text("Mengetahui HR,", mx + sigBoxWidth + 10, y);
  y += 4;

  const sigY = y;
  try {
    doc.addImage(data.employee_signature_data, "PNG", mx, sigY, 45, 22);
  } catch {
    /* ignore malformed signature */
  }
  if (data.hr_signature_data) {
    try {
      doc.addImage(data.hr_signature_data, "PNG", mx + sigBoxWidth + 10, sigY, 45, 22);
    } catch {
      /* ignore malformed signature */
    }
  }

  y = sigY + 26;
  doc.setFont("helvetica", "normal");
  doc.text(data.employee_name || "-", mx, y);
  doc.text(data.hr_signed_by_name || "(menunggu persetujuan)", mx + sigBoxWidth + 10, y);
  y += 5;
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(`Ditandatangani: ${formatDate(data.employee_signed_at)}`, mx, y);
  if (data.hr_signed_at) {
    doc.text(`Disetujui: ${formatDate(data.hr_signed_at)}`, mx + sigBoxWidth + 10, y);
  }

  return doc.output("blob");
}
