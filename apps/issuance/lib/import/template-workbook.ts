// Builds the blank spreadsheet an admin can start an import from: the exact headings the
// importer expects, plus one clearly-marked example row. Generated from the template's own
// field schema, so it cannot drift from what `mapColumns` accepts.
import * as XLSX from "xlsx";
import {
  buildImportGuide,
  guideExampleRow,
  type CertificateData,
  type FieldSchema,
} from "@moraspirit/shared";

export const WORKBOOK_SHEET = "Import";

export function buildTemplateWorkbook(schema: FieldSchema, sample: CertificateData): Buffer {
  const headings = buildImportGuide(schema).map((c) => c.heading);
  const example = guideExampleRow(schema, sample);

  const sheet = XLSX.utils.aoa_to_sheet([headings, example]);
  sheet["!cols"] = headings.map((h, i) => ({
    wch: Math.min(60, Math.max(h.length + 2, ...example[i].split("\n").map((l) => l.length + 2))),
  }));

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, WORKBOOK_SHEET);
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
