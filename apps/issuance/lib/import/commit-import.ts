// Commits an import: ONE transaction creating the batch, the chosen certificates and a
// `created` audit row for each (AGENTS.md §5). The file is analyzed again here, fit check
// included, so what is written is what the server validated, not what the browser reported.
import type { Prisma } from "@moraspirit/db";
import type { CertificateData } from "@moraspirit/shared";
import { newCertificateId } from "../verify-url";
import { analyzeImport, type AnalyzeInput } from "./analyze-import";

export interface CommitInput extends AnalyzeInput {
  adminId: number;
  /** Rows the admin marked "Issue anyway" (by row number); flagged duplicates are skipped otherwise. */
  issueAnywayRows: number[];
  /** The admin ticked "Skip invalid rows and import the rest". */
  skipInvalid: boolean;
  /** The admin confirmed importing a file that was imported before. */
  confirmDuplicateFile: boolean;
}

export type CommitResult =
  | { status: "committed"; batchId: number; inserted: number; skipped: number; rejected: number }
  | { status: "blocked"; reason: string }
  | { status: "not_ready"; message: string };

export async function commitImport(input: CommitInput): Promise<CommitResult> {
  const analysis = await analyzeImport(input);
  if (analysis.status !== "ready") {
    return {
      status: "not_ready",
      message: "The file could not be validated; nothing was imported.",
    };
  }

  const invalid = analysis.rows.filter((r) => Object.keys(r.errors).length > 0);
  if (invalid.length > 0 && !input.skipInvalid) {
    return {
      status: "blocked",
      reason: `${invalid.length} row(s) have errors. Fix the file, or choose to skip the invalid rows.`,
    };
  }
  if (analysis.fileDuplicate && !input.confirmDuplicateFile) {
    return {
      status: "blocked",
      reason: "This file was already imported; confirm to import it again.",
    };
  }

  const anyway = new Set(input.issueAnywayRows);
  const valid = analysis.rows.flatMap((r) =>
    Object.keys(r.errors).length === 0 && r.data && r.dedupeKey
      ? [{ rowNumber: r.rowNumber, data: r.data, dedupeKey: r.dedupeKey, flagged: !!r.duplicate }]
      : [],
  );
  const toIssue = valid.filter((r) => !r.flagged || anyway.has(r.rowNumber));
  const skipped = valid.length - toIssue.length;
  if (toIssue.length === 0) {
    return { status: "blocked", reason: "There are no rows left to import." };
  }

  const json = (data: CertificateData) => data as unknown as Prisma.InputJsonValue;
  const batchId = await input.prisma.$transaction(async (tx) => {
    const batch = await tx.importBatch.create({
      data: {
        templateVersionId: analysis.templateVersionId,
        fileName: input.fileName.slice(0, 255),
        fileType: analysis.fileType,
        sheetName: analysis.sheetName,
        fileHash: analysis.fileHash,
        rowCount: analysis.rows.length,
        insertedCount: toIssue.length,
        skippedCount: skipped,
        rejectedCount: invalid.length,
        adminUserId: input.adminId,
      },
    });
    const prepared = toIssue.map((row) => ({ row, id: newCertificateId() }));
    await tx.certificate.createMany({
      data: prepared.map(({ row, id }) => ({
        id,
        templateVersionId: analysis.templateVersionId,
        data: json(row.data),
        importBatchId: batch.id,
        dedupeKey: row.dedupeKey,
        status: "active" as const,
      })),
    });
    await tx.certificateAudit.createMany({
      data: prepared.map(({ row, id }) => ({
        certificateId: id,
        action: "created" as const,
        newData: json(row.data),
        adminUserId: input.adminId,
      })),
    });
    return batch.id;
  });

  return {
    status: "committed",
    batchId,
    inserted: toIssue.length,
    skipped,
    rejected: invalid.length,
  };
}
