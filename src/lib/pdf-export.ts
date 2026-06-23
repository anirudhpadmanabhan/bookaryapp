import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type ExportColumn<T> = { header: string; get: (row: T) => string | number | null | undefined };

export function exportPdf<T>(opts: {
  filename: string;
  title: string;
  subtitle?: string;
  columns: ExportColumn<T>[];
  rows: T[];
}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(14);
  doc.text(opts.title, 40, 36);
  if (opts.subtitle) {
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(opts.subtitle, 40, 52);
    doc.setTextColor(0);
  }
  autoTable(doc, {
    startY: opts.subtitle ? 64 : 50,
    head: [opts.columns.map((c) => c.header)],
    body: opts.rows.map((r) => opts.columns.map((c) => {
      const v = c.get(r);
      return v == null ? "" : String(v);
    })),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [99, 102, 241], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 250] },
  });
  doc.save(opts.filename);
}

export function exportCsv<T>(opts: {
  filename: string;
  columns: ExportColumn<T>[];
  rows: T[];
}) {
  const esc = (s: any) => {
    const v = s == null ? "" : String(s);
    return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  const header = opts.columns.map((c) => esc(c.header)).join(",");
  const body = opts.rows.map((r) => opts.columns.map((c) => esc(c.get(r))).join(",")).join("\n");
  const blob = new Blob([header + "\n" + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = opts.filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
