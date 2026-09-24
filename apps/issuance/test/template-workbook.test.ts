// The blank spreadsheet offered on /imports/new must be accepted by the real importer for
// every published template: same headings, and the example row converts and validates.
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { loadAllTemplates } from "@moraspirit/certificate-templates";
import {
  applyDefaults,
  buildImportGuide,
  convertRow,
  dataFromRawValues,
  mapColumns,
  validateCertificateData,
} from "@moraspirit/shared";
import { readImportFile } from "../lib/import/read-file";
import { buildTemplateWorkbook, WORKBOOK_SHEET } from "../lib/import/template-workbook";

describe.each(loadAllTemplates().map((t) => [t.slug, t] as const))("blank workbook: %s", (_, t) => {
  const file = buildTemplateWorkbook(t.fieldSchema, t.sampleData);
  const table = readImportFile({ buffer: file, fileName: "blank.xlsx" });

  it("is a single worksheet named Import, with a header row and one example row", () => {
    expect(XLSX.read(file, { type: "buffer" }).SheetNames).toEqual([WORKBOOK_SHEET]);
    expect(table.rows).toHaveLength(1);
  });

  it("has exactly the guide's headings, and the importer maps every one", () => {
    expect(table.headers).toEqual(buildImportGuide(t.fieldSchema).map((c) => c.heading));
    const mapping = mapColumns(t.fieldSchema, table.headers);
    expect(mapping.missingRequired).toEqual([]);
    expect(mapping.unknown).toEqual([]);
    expect(mapping.duplicated).toEqual([]);
  });

  it("has an example row that converts and validates, marked so it is deleted", () => {
    const mapping = mapColumns(t.fieldSchema, table.headers);
    const { raw, errors } = convertRow(t.fieldSchema, mapping, table.rows[0].cells);
    expect(errors).toEqual({});
    const data = applyDefaults(t.fieldSchema, dataFromRawValues(t.fieldSchema, raw));
    expect(validateCertificateData(t.fieldSchema, data).ok).toBe(true);
    expect(table.rows[0].cells[0]).toBe("EXAMPLE-DELETE-THIS-ROW");
  });
});
