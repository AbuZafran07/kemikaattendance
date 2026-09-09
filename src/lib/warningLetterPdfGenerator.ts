import jsPDF from "jspdf";
import { loadImageAsBase64 } from "@/lib/payslipPdfGenerator";
import letterheadSrc from "@/assets/kemika-letterhead.jpg";


const GREEN = [0, 135, 81] as const;
const DARK_GREEN = [0, 92, 56] as const;
const DARK_TEXT = [33, 37, 41] as const;
const GRAY_TEXT = [110, 110, 110] as const;

const MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export interface WarningLetterData {
  id: string;
  warning_type: "sp1" | "sp2" | string;
  period_month: string; // YYYY-MM-DD
  violation_count_at_issuance: number;
  issue_date: string;
  employee_name: string;
  nik?: string | null;
  jabatan?: string | null;
  departemen?: string | null;
  monthly_threshold?: number;
}

const formatLongDate = (value: string): string => {
  const d = new Date(value);
  return `${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
};

export const buildWarningLetterNumber = (data: WarningLetterData): string => {
  const d = new Date(data.issue_date);
  const seq = data.id.replace(/\D/g, "").slice(0, 3).padStart(3, "0");
  const roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"][d.getMonth()];
  return `${seq}/${data.warning_type.toUpperCase()}-HRD/KKP/${roman}/${d.getFullYear()}`;
};

export async function generateWarningLetterPDF(
  data: WarningLetterData,
  logoSrc: string,
): Promise<Blob> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const mx = 18;
  const rightEnd = pw - mx;
  const contentWidth = rightEnd - mx;

  const isSp2 = data.warning_type.toLowerCase() === "sp2";
  const levelLabel = isSp2 ? "SURAT PERINGATAN KEDUA (SP-2)" : "SURAT PERINGATAN PERTAMA (SP-1)";
  const periodDate = new Date(data.period_month);
  const periodLabel = `${MONTHS_ID[periodDate.getMonth()]} ${periodDate.getFullYear()}`;

  let logoBase64: string | null = null;
  try {
    logoBase64 = await loadImageAsBase64(logoSrc);
  } catch {
    /* logo optional */
  }

  // ── HEADER ──
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, pw, 4, "F");

  let y = 15;
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
  doc.text("Jl. Uri Beta Selatan Raya No. 78 Larangan Utara, Kota Tangerang 15154", mx + 22, y + 13);

  y = 34;
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.8);
  doc.line(mx, y, rightEnd, y);

  // ── TITLE ──
  y += 9;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...DARK_GREEN);
  doc.text(levelLabel, pw / 2, y, { align: "center" });
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRAY_TEXT);
  doc.text(`Nomor: ${buildWarningLetterNumber(data)}`, pw / 2, y, { align: "center" });

  // ── EMPLOYEE DATA ──
  y += 12;
  doc.setFontSize(10);
  doc.setTextColor(...DARK_TEXT);
  doc.setFont("helvetica", "bold");
  doc.text("Ditujukan kepada:", mx, y);
  y += 6;

  const infoRows: [string, string][] = [
    ["Nama", data.employee_name || "-"],
    ["NIK", data.nik || "-"],
    ["Jabatan", data.jabatan || "-"],
    ["Departemen", data.departemen || "-"],
  ];
  for (const [label, value] of infoRows) {
    doc.setFont("helvetica", "normal");
    doc.text(label, mx + 2, y);
    doc.text(":", mx + 34, y);
    doc.setFont("helvetica", "bold");
    doc.text(value, mx + 38, y);
    y += 5.5;
  }

  // ── BODY ──
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const paragraphs: string[] = [
    `Berdasarkan hasil pemantauan disiplin kehadiran karyawan pada periode ${periodLabel}, tercatat sebanyak ${data.violation_count_at_issuance} pelanggaran kehadiran, meliputi keterlambatan tanpa alasan yang disetujui dan/atau ketidakhadiran tanpa keterangan.`,
    isSp2
      ? `Sehubungan dengan hal tersebut dan karena Surat Peringatan Pertama (SP-1) yang telah diterbitkan sebelumnya belum menunjukkan perbaikan, dengan ini Perusahaan menerbitkan SURAT PERINGATAN KEDUA (SP-2) kepada Saudara/i.`
      : `Sehubungan dengan hal tersebut, dengan ini Perusahaan menerbitkan SURAT PERINGATAN PERTAMA (SP-1) kepada Saudara/i sebagai bentuk pembinaan disiplin kerja.`,
    `Saudara/i diwajibkan memperbaiki kedisiplinan kehadiran, hadir tepat waktu sesuai jam kerja yang berlaku, serta menyampaikan izin/keterangan resmi melalui aplikasi apabila berhalangan hadir.`,
    isSp2
      ? `Apabila pelanggaran serupa masih terjadi setelah surat ini diterbitkan, Perusahaan dapat mengambil tindakan lebih lanjut sesuai Peraturan Perusahaan dan ketentuan perundang-undangan yang berlaku, termasuk penguncian akses absensi hingga proses pembinaan (coaching) bersama HR diselesaikan.`
      : `Apabila dalam periode berikutnya pelanggaran masih berulang, Perusahaan akan menerbitkan Surat Peringatan Kedua (SP-2) dan tindakan pembinaan lanjutan sesuai Peraturan Perusahaan.`,
    `Surat peringatan ini berlaku sejak tanggal diterbitkan dan menjadi bagian dari catatan kepegawaian Saudara/i.`,
  ];

  for (const paragraph of paragraphs) {
    const lines = doc.splitTextToSize(paragraph, contentWidth);
    doc.text(lines, mx, y, { align: "justify", maxWidth: contentWidth });
    y += lines.length * 5 + 4;
  }

  // ── SUMMARY BOX ──
  y += 2;
  doc.setFillColor(245, 248, 246);
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.3);
  doc.roundedRect(mx, y, contentWidth, 20, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...DARK_GREEN);
  doc.text("RINGKASAN PELANGGARAN", mx + 4, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...DARK_TEXT);
  doc.text(`Periode: ${periodLabel}`, mx + 4, y + 12);
  doc.text(`Jumlah pelanggaran: ${data.violation_count_at_issuance}`, mx + 4, y + 17);
  if (data.monthly_threshold) {
    doc.text(`Ambang batas: ${data.monthly_threshold} pelanggaran/bulan`, mx + 90, y + 12);
  }
  doc.text(`Tanggal terbit: ${formatLongDate(data.issue_date)}`, mx + 90, y + 17);
  y += 30;

  // ── SIGNATURE ──
  doc.setFontSize(10);
  doc.setTextColor(...DARK_TEXT);
  doc.text(`Tangerang, ${formatLongDate(data.issue_date)}`, rightEnd, y, { align: "right" });
  y += 8;

  const colWidth = (contentWidth - 20) / 2;
  doc.setFont("helvetica", "bold");
  doc.text("Human Resources Department", mx, y);
  doc.text("Diterima oleh Karyawan", mx + colWidth + 20, y);

  y += 26;
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.3);
  doc.line(mx, y, mx + 55, y);
  doc.line(mx + colWidth + 20, y, mx + colWidth + 75, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("HRD PT. Kemika Karya Pratama", mx, y);
  doc.text(data.employee_name || "-", mx + colWidth + 20, y);

  // ── FOOTER ──
  const ph = doc.internal.pageSize.getHeight();
  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY_TEXT);
  doc.text(
    "Dokumen ini diterbitkan otomatis oleh sistem Kemika Attendance (HRIS) berdasarkan data kehadiran karyawan.",
    pw / 2,
    ph - 12,
    { align: "center" },
  );
  doc.setFillColor(...GREEN);
  doc.rect(0, ph - 4, pw, 4, "F");

  return doc.output("blob");
}
