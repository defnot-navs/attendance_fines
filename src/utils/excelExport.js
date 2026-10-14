import * as XLSX from 'xlsx';

/**
 * Download an array of flat objects as an .xlsx file (single sheet, auto-sized columns).
 */
export function exportToExcel(rows, filename, sheetName = 'Sheet1') {
  if (!rows || rows.length === 0) {
    throw new Error('No data to export');
  }
  const sheet = XLSX.utils.json_to_sheet(rows);
  const headers = Object.keys(rows[0]);
  sheet['!cols'] = headers.map((h) => ({
    wch: Math.min(40, Math.max(String(h).length, ...rows.map((r) => String(r[h] ?? '').length)) + 2),
  }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName.slice(0, 31));
  XLSX.writeFile(workbook, filename);
}
