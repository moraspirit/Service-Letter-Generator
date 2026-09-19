// Issuing a certificate: validate, sanitize, warn about duplicates, prove the letter
// fits on one page, then insert the certificate and its `created` audit row in ONE
// transaction (AGENTS.md §5: no certificate exists without an audit row).
import type { Prisma, PrismaClient } from "@moraspirit/db";
import {
  dataFromRawValues,
  validateCertificateData,
  type CertificateData,
  type FieldSchema,
  type RawValues,
} from "@moraspirit/shared";
import { computeDedupeKey } from "./dedupe";
import { PageOverflowError, renderCertificatePdf, type RenderInput } from "./pdf/render-pdf";
import { sanitizeRichTextFields } from "./sanitize";
import { newCertificateId } from "./verify-url";

export interface DuplicateMatch {
  id: string;
  status: "active" | "revoked";
  issuedAt: Date;
}

export type IssueResult =
  | { status: "issued"; id: string }
  | { status: "invalid"; errors: Record<string, string> }
  | { status: "duplicate"; existing: DuplicateMatch[] }
  | { status: "overflow"; message: string; field: string | null }
  | { status: "render_failed"; message: string };

export interface IssueInput {
  prisma: PrismaClient;
  adminId: number;
  templateId: number;
  rawValues: RawValues;
  /** The admin saw the duplicate warning and chose "Issue anyway". */
  confirmDuplicate: boolean;
  /** Replaceable in tests that do not need a browser. */
  renderPdf?: (input: RenderInput) => Promise<Uint8Array>;
}

export class TemplateNotPublishedError extends Error {}

export async function issueCertificate(input: IssueInput): Promise<IssueResult> {
  const { prisma, adminId, templateId, rawValues, confirmDuplicate } = input;
  const renderPdf = input.renderPdf ?? renderCertificatePdf;

  const template = await prisma.template.findUnique({
    where: { id: templateId },
    include: { currentVersion: true },
  });
  const version = template?.currentVersion;
  if (!template || !version)
    throw new TemplateNotPublishedError("Template has no published version");

  const fieldSchema = version.fieldSchema as unknown as FieldSchema;

  // 1. Validate and sanitize.
  const validation = validateCertificateData(
    fieldSchema,
    dataFromRawValues(fieldSchema, rawValues),
  );
  if (!validation.ok) return { status: "invalid", errors: validation.errors };
  const data: CertificateData = sanitizeRichTextFields(fieldSchema, validation.data);

  // 2. Duplicate warning (never a block).
  const dedupeKey = computeDedupeKey(template.id, fieldSchema, data);
  if (!confirmDuplicate) {
    const existing = await prisma.certificate.findMany({
      where: { dedupeKey },
      select: { id: true, status: true, issuedAt: true },
      orderBy: { issuedAt: "desc" },
      take: 5,
    });
    if (existing.length > 0) return { status: "duplicate", existing };
  }

  // 3. Prove it renders on one page BEFORE anything is saved, using the exact id it will get.
  const id = newCertificateId();
  try {
    await renderPdf({
      certificateId: id,
      templateVersion: { htmlContent: version.htmlContent, fieldSchema },
      data,
    });
  } catch (error) {
    if (error instanceof PageOverflowError) {
      return { status: "overflow", message: error.message, field: error.field };
    }
    return {
      status: "render_failed",
      message: `The PDF could not be rendered: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }

  // 4. One transaction: certificate + audit row.
  const json = data as unknown as Prisma.InputJsonValue;
  await prisma.$transaction(async (tx) => {
    await tx.certificate.create({
      data: { id, templateVersionId: version.id, data: json, dedupeKey, status: "active" },
    });
    await tx.certificateAudit.create({
      data: { certificateId: id, action: "created", newData: json, adminUserId: adminId },
    });
  });
  return { status: "issued", id };
}
