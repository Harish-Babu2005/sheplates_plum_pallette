import * as XLSX from "xlsx";

/**
 * Builds a real .xlsx workbook client-side (SheetJS) and triggers a browser download.
 * Used by Audit log, Vendor payments and the Reports centre so Operations / Super Admin
 * can export any dataset as Excel for offline analysis, audit or sharing.
 */
export function downloadWorkbook(filename: string, sheets: { name: string; rows: Record<string, unknown>[] }[]) {
  const workbook = XLSX.utils.book_new();
  sheets.forEach((sheet) => {
    const rows = sheet.rows.length ? sheet.rows : [{ "No data": "No rows matched the selected filters" }];
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31) || "Sheet1");
  });
  const arrayBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
