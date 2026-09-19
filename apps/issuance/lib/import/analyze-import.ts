// Validates an uploaded spreadsheet against a template and reports, row by row, what would
// happen if it were imported. Writes nothing. The same function runs again at commit time
// (commit-import.ts), so the report the admin confirms is never trusted from the browser.
import type { PrismaClient } from "@moraspirit/db";
import {
  convertRow,
  dataFromRawValues,
  mapColumns,
  validateCertificateData,
  type CertificateData,
  type ColumnMapping,
  type FieldSchema,
} from "@moraspirit/shared";
import { computeDedupeKey } from "../dedupe";
import { PageOverflowError, renderCertificatePdf, type RenderInput } from "../pdf/render-pdf";
import { sanitizeRichTextFields } from "../sanitize";
import { newCertificateId } from "../verify-url";
import { ImportFileError, readImportFile, type SheetTable } from "./read-file";

export interface DuplicateInfo {
  existing: { id: string; status: "active" | "revoked"; issuedAt: string }[];
  /** Row number of an earlier row in the same file with the same key. */
  earlierRow: number | null;
}

export interface AnalyzedRow {
  rowNumber: number;
  /** Shown to the admin so they can find the row: member id and name as typed. */
  label: string;
  errors: Record<string, string>;
  /** Only present for rows without errors. */
  data?: CertificateData;
  dedupeKey?: string;
  duplicate?: DuplicateInfo;
}

export interface FileDuplicate {
  importedAt: string;
  adminEmail: string;
  insertedCount: number;
}

export type AnalysisResult =
  | { status: "file_error"; message: string }
  | { status: "template_error"; message: string }
  | { status: "choose_sheet"; sheetNames: string[] }
  | {
      status: "column_error";
      missingRequired: string[];
      duplicated: string[];
      unknown: string[];
    }
  | {
      status: "ready";
      fileType: "xlsx" | "csv";
      fileHash: string;
      sheetName: string | null;
      templateVersionId: number;
      templateVersionNumber: number;
      unknownColumns: string[];
      rows: AnalyzedRow[];
      fileDuplicate: FileDuplicate | null;
    };

export interface AnalyzeInput {
  prisma: PrismaClient;
  templateId: number;
  buffer: Buffer;
  fileName: string;
  sheetName?: string;
  /** Replaceable in tests that do not need a browser. */
  renderPdf?: (input: RenderInput) => Promise<Uint8Array>;
}

const RENDER_CONCURRENCY = 2;

async function forEachLimited<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await fn(items[next++]!);
  });
  await Promise.all(workers);
}

function labelFor(schema: FieldSchema, mapping: ColumnMapping, cells: readonly string[]): string {
  const parts = ["member_id", "recipient_name"].flatMap((name) => {
    const field = schema.find((f) => f.name === name);
    const col = mapping.columns.find((c) => c.target === field?.name);
    const value = col ? (cells[col.index] ?? "").trim() : "";
    return value ? [value] : [];
  });
  return parts.join(" — ");
}

export async function analyzeImport(input: AnalyzeInput): Promise<AnalysisResult> {
  const { prisma } = input;
  const renderPdf = input.renderPdf ?? renderCertificatePdf;

  let table: SheetTable;
  try {
    table = readImportFile({
      buffer: input.buffer,
      fileName: input.fileName,
      sheetName: input.sheetName,
    });
  } catch (error) {
    if (error instanceof ImportFileError) return { status: "file_error", message: error.message };
    throw error;
  }
  if (table.fileType === "xlsx" && !table.sheetName) {
    return { status: "choose_sheet", sheetNames: table.sheetNames };
  }

  const template = await prisma.template.findUnique({
    where: { id: input.templateId },
    include: { currentVersion: true },
  });
  const version = template?.currentVersion;
  if (!template || !version) {
    return { status: "template_error", message: "That template has no published version." };
  }
  const schema = version.fieldSchema as unknown as FieldSchema;

  const mapping = mapColumns(schema, table.headers);
  if (mapping.missingRequired.length > 0 || mapping.duplicated.length > 0) {
    return {
      status: "column_error",
      missingRequired: mapping.missingRequired,
      duplicated: mapping.duplicated,
      unknown: mapping.unknown,
    };
  }
  if (table.rows.length === 0) {
    return { status: "file_error", message: "The file has a header row but no data rows." };
  }

  // 1. Validate every row.
  const rows: AnalyzedRow[] = table.rows.map(({ rowNumber, cells }) => {
    const label = labelFor(schema, mapping, cells);
    const converted = convertRow(schema, mapping, cells);
    const validation = validateCertificateData(schema, dataFromRawValues(schema, converted.raw));
    // A date that could not be parsed is reported as such, not as "required".
    const errors = { ...(validation.ok ? {} : validation.errors), ...converted.errors };
    if (!validation.ok || Object.keys(converted.errors).length > 0) {
      return { rowNumber, label, errors };
    }
    const data = sanitizeRichTextFields(schema, validation.data);
    return {
      rowNumber,
      label,
      errors,
      data,
      dedupeKey: computeDedupeKey(template.id, schema, data),
    };
  });

  // 2. Duplicates: against existing certificates, and against earlier rows in this file.
  const keys = [...new Set(rows.flatMap((r) => (r.dedupeKey ? [r.dedupeKey] : [])))];
  const existing = keys.length
    ? await prisma.certificate.findMany({
        where: { dedupeKey: { in: keys } },
        select: { id: true, status: true, issuedAt: true, dedupeKey: true },
        orderBy: { issuedAt: "desc" },
      })
    : [];
  const firstRowWithKey = new Map<string, number>();
  for (const row of rows) {
    if (!row.dedupeKey) continue;
    const matches = existing
      .filter((c) => c.dedupeKey === row.dedupeKey)
      .slice(0, 5)
      .map((c) => ({ id: c.id, status: c.status, issuedAt: c.issuedAt.toISOString() }));
    const earlierRow = firstRowWithKey.get(row.dedupeKey) ?? null;
    if (earlierRow === null) firstRowWithKey.set(row.dedupeKey, row.rowNumber);
    if (matches.length > 0 || earlierRow !== null) {
      row.duplicate = { existing: matches, earlierRow };
    }
  }

  // 3. Fit check: render each valid row exactly as it would be issued; an overflow is a row error.
  await forEachLimited(
    rows.filter((r) => r.data),
    RENDER_CONCURRENCY,
    async (row) => {
      try {
        await renderPdf({
          certificateId: newCertificateId(),
          templateVersion: { htmlContent: version.htmlContent, fieldSchema: schema },
          data: row.data!,
        });
      } catch (error) {
        const field = error instanceof PageOverflowError ? error.field : null;
        row.errors[field ?? "_render"] =
          error instanceof PageOverflowError
            ? error.message
            : `The PDF could not be rendered: ${error instanceof Error ? error.message : "unknown error"}`;
        delete row.data;
        delete row.dedupeKey;
        delete row.duplicate;
      }
    },
  );

  // 4. Was this exact file imported before?
  const previous = await prisma.importBatch.findFirst({
    where: { fileHash: table.fileHash },
    orderBy: { createdAt: "desc" },
    include: { adminUser: { select: { email: true } } },
  });

  return {
    status: "ready",
    fileType: table.fileType,
    fileHash: table.fileHash,
    sheetName: table.sheetName,
    templateVersionId: version.id,
    templateVersionNumber: version.versionNumber,
    unknownColumns: mapping.unknown,
    rows,
    fileDuplicate: previous
      ? {
          importedAt: previous.createdAt.toISOString(),
          adminEmail: previous.adminUser.email,
          insertedCount: previous.insertedCount,
        }
      : null,
  };
}
