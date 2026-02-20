import ExcelJS from 'exceljs';

/**
 * Create an Excel workbook from an array of objects and trigger download.
 * Replaces the vulnerable xlsx (SheetJS) library.
 */
export async function exportToExcelFile(
  data: Record<string, any>[],
  sheetName: string,
  fileName: string,
  headerRows?: string[][]
) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  // Add optional header rows (e.g. employee info)
  if (headerRows && headerRows.length > 0) {
    for (const row of headerRows) {
      worksheet.addRow(row);
    }
    worksheet.addRow([]); // blank separator
  }

  if (data.length === 0) return;

  // Add column headers
  const columns = Object.keys(data[0]);
  const headerRow = worksheet.addRow(columns);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF008751' },
    };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  });

  // Add data rows
  for (const item of data) {
    worksheet.addRow(columns.map((col) => item[col]));
  }

  // Auto-fit column widths (approximate)
  worksheet.columns.forEach((col) => {
    let maxLen = 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? '').length;
      if (len > maxLen) maxLen = len;
    });
    col.width = Math.min(maxLen + 2, 40);
  });

  // Generate and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
