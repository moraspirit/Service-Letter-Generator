// Reads an uploaded .xlsx or UTF-8 .csv into plain strings. Everything format-specific
// (Excel date cells, BOMs, encodings) is settled here so the rest of the import only
// ever sees a header row and rows of trimmed-later strings.
import { createHash } from "node:crypto";
import Papa from "papaparse";
import * as XLSX from "xlsx";

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 500;

export class ImportFileError extends Error {}

export interface SheetTable {
  fileType: "xlsx" | "csv";
  fileHash: string;
  /** Worksheets in an .xlsx (empty for .csv). */
  sheetNames: string[];
  sheetName: string | null;
  headers: string[];
  /** Non-empty data rows; `rowNumber` is the 1-based row in the file, header = row 1. */
  rows: { rowNumber: number; cells: string[] }[];
}

const isBlankRow = (cells: string[]) => cells.every((c) => c.trim() === "");

function fileTypeOf(fileName: string): "xlsx" | "csv" {
  const ext = fileName.toLowerCase().split(".").pop();
  if (ext === "xlsx") return "xlsx";
  if (ext === "csv") return "csv";
  throw new ImportFileError("Upload an .xlsx or .csv file.");
}

function finish(base: Omit<SheetTable, "headers" | "rows">, matrix: string[][]): SheetTable {
  const [headers = [], ...body] = matrix;
  const rows = body
    .map((cells, i) => ({ rowNumber: i + 2, cells }))
    .filter((row) => !isBlankRow(row.cells));
  if (rows.length > MAX_IMPORT_ROWS) {
    throw new ImportFileError(`The file has ${rows.length} rows; the limit is ${MAX_IMPORT_ROWS}.`);
  }
  return { ...base, headers, rows };
}

function readCsv(buffer: Buffer, base: Omit<SheetTable, "headers" | "rows">): SheetTable {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    throw new ImportFileError(
      "This CSV is not UTF-8 (Excel's default CSV export is not). Upload the .xlsx file instead.",
    );
  }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: false });
  const fatal = parsed.errors.find((e) => e.type === "Quotes");
  if (fatal) throw new ImportFileError(`The CSV could not be read (${fatal.message}).`);
  return finish(
    base,
    parsed.data.map((row) => row.map((c) => String(c ?? ""))),
  );
}

/** A cell as text; real Excel date cells become ISO dates with no time-zone shift. */
function cellText(cell: XLSX.CellObject | undefined): string {
  if (!cell || cell.v === undefined || cell.v === null) return "";
  if (cell.t === "n" && typeof cell.v === "number" && cell.z && XLSX.SSF.is_date(String(cell.z))) {
    const d = XLSX.SSF.parse_date_code(cell.v);
    if (d)
      return `${String(d.y).padStart(4, "0")}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  return String(cell.v);
}

function readXlsx(
  buffer: Buffer,
  sheetName: string | undefined,
  base: Omit<SheetTable, "headers" | "rows">,
): SheetTable {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer", cellDates: false, cellNF: true });
  } catch {
    throw new ImportFileError("The .xlsx file could not be read.");
  }
  const names = workbook.SheetNames;
  if (names.length === 0) throw new ImportFileError("The workbook has no worksheets.");
  const chosen = sheetName ?? (names.length === 1 ? names[0] : undefined);
  const info = { ...base, sheetNames: names, sheetName: chosen ?? null };
  if (!chosen) return { ...info, headers: [], rows: [] };
  const sheet = workbook.Sheets[chosen];
  if (!sheet) throw new ImportFileError(`The workbook has no worksheet named "${chosen}".`);

  const ref = sheet["!ref"];
  if (!ref) return { ...info, headers: [], rows: [] };
  const range = XLSX.utils.decode_range(ref);
  const matrix: string[][] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const cells: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      cells.push(cellText(sheet[XLSX.utils.encode_cell({ r, c })]));
    }
    matrix.push(cells);
  }
  return finish(info, matrix);
}

/** Parse an uploaded file. For a multi-sheet workbook with no `sheetName`, `rows` is empty and `sheetName` null. */
export function readImportFile(input: {
  buffer: Buffer;
  fileName: string;
  sheetName?: string;
}): SheetTable {
  if (input.buffer.length === 0) throw new ImportFileError("The file is empty.");
  if (input.buffer.length > MAX_IMPORT_BYTES) {
    throw new ImportFileError("The file is larger than 5 MB.");
  }
  const fileType = fileTypeOf(input.fileName);
  const base = {
    fileType,
    fileHash: createHash("sha256").update(input.buffer).digest("hex"),
    sheetNames: [] as string[],
    sheetName: null as string | null,
  };
  return fileType === "csv"
    ? readCsv(input.buffer, base)
    : readXlsx(input.buffer, input.sheetName, base);
}
