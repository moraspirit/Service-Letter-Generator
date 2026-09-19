// Everything that changes an existing certificate: edit, revoke, restore. Each one
// writes its audit row in the SAME transaction as the change (AGENTS.md §5), never
// deletes anything, and leaves `template_version_id` untouched.
import type { Prisma, PrismaClient } from "@moraspirit/db";
import {
  dataFromRawValues,
  validateCertificateData,
  type CertificateData,
  type FieldSchema,
  type RawValues,
} from "@moraspirit/shared";
import { computeDedupeKey } from "./dedupe";
import type { DuplicateMatch } from "./issue-certificate";
import { PageOverflowError, renderCertificatePdf, type RenderInput } from "./pdf/render-pdf";
import { sanitizeRichTextFields } from "./sanitize";

export const REASON_MAX_LENGTH = 500;

export type ChangeResult =
  | { status: "changed" }
  | { status: "invalid"; errors: Record<string, string> }
  | { status: "duplicate"; existing: DuplicateMatch[] }
  | { status: "overflow"; message: string; field: string | null }
  | { status: "render_failed"; message: string }
  | { status: "conflict" }
  | { status: "no_changes" }
  | { status: "not_found" }
  | { status: "wrong_state"; message: string };

interface Common {
  prisma: PrismaClient;
  adminId: number;
  certificateId: string;
}

/** Returns the cleaned reason, or an error message. */
function checkReason(reason: string): { reason: string } | { error: string } {
  const trimmed = reason.trim();
  if (trimmed.length === 0) return { error: "A reason is required" };
  if (trimmed.length > REASON_MAX_LENGTH) {
    return { error: `The reason must be at most ${REASON_MAX_LENGTH} characters` };
  }
  return { reason: trimmed };
}

/** Thrown inside a transaction to roll it back when the row changed underneath us. */
class ConflictError extends Error {}

const sameData = (a: unknown, b: unknown) =>
  JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0))
        .map(([k, v]) => [k, sortKeys(v)]),
    );
  }
  return value;
}

export interface EditInput extends Common {
  rawValues: RawValues;
  reason: string;
  /** `updatedAt` of the record as the admin saw it (ISO string); a newer row means a conflict. */
  loadedUpdatedAt: string;
  confirmDuplicate: boolean;
  renderPdf?: (input: RenderInput) => Promise<Uint8Array>;
}

export async function editCertificate(input: EditInput): Promise<ChangeResult> {
  const { prisma, adminId, certificateId, rawValues, confirmDuplicate } = input;
  const renderPdf = input.renderPdf ?? renderCertificatePdf;

  const certificate = await prisma.certificate.findUnique({
    where: { id: certificateId },
    include: { templateVersion: true },
  });
  if (!certificate) return { status: "not_found" };
  if (certificate.status === "revoked") {
    return {
      status: "wrong_state",
      message: "This certificate is revoked. Restore it before editing.",
    };
  }

  const reason = checkReason(input.reason);
  const errors: Record<string, string> = {};
  if ("error" in reason) errors.reason = reason.error;

  // The pinned version's schema, never the template's latest.
  const version = certificate.templateVersion;
  const fieldSchema = version.fieldSchema as unknown as FieldSchema;
  const validation = validateCertificateData(
    fieldSchema,
    dataFromRawValues(fieldSchema, rawValues),
  );
  if (!validation.ok) Object.assign(errors, validation.errors);
  if (Object.keys(errors).length > 0 || !validation.ok || "error" in reason) {
    return { status: "invalid", errors };
  }

  const data: CertificateData = sanitizeRichTextFields(fieldSchema, validation.data);
  const oldData = certificate.data as unknown as CertificateData;
  if (sameData(data, oldData)) return { status: "no_changes" };

  // Duplicate warning only when the edit actually moves the certificate onto another's key.
  const dedupeKey = computeDedupeKey(version.templateId, fieldSchema, data);
  if (!confirmDuplicate && dedupeKey !== certificate.dedupeKey) {
    const existing = await prisma.certificate.findMany({
      where: { dedupeKey, id: { not: certificate.id } },
      select: { id: true, status: true, issuedAt: true },
      orderBy: { issuedAt: "desc" },
      take: 5,
    });
    if (existing.length > 0) return { status: "duplicate", existing };
  }

  // The edited letter must still fit on one page.
  try {
    await renderPdf({
      certificateId: certificate.id,
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

  try {
    await prisma.$transaction(async (tx) => {
      // Optimistic lock: only update the row if nobody changed it since it was loaded.
      const updated = await tx.certificate.updateMany({
        where: {
          id: certificate.id,
          status: "active",
          updatedAt: new Date(input.loadedUpdatedAt),
        },
        data: { data: data as unknown as Prisma.InputJsonValue, dedupeKey },
      });
      if (updated.count !== 1) throw new ConflictError();
      await tx.certificateAudit.create({
        data: {
          certificateId: certificate.id,
          action: "edited",
          oldData: oldData as unknown as Prisma.InputJsonValue,
          newData: data as unknown as Prisma.InputJsonValue,
          reason: reason.reason,
          adminUserId: adminId,
        },
      });
    });
  } catch (error) {
    if (error instanceof ConflictError) return { status: "conflict" };
    throw error;
  }
  return { status: "changed" };
}

async function changeStatus(
  input: Common & { reason: string },
  from: "active" | "revoked",
): Promise<ChangeResult> {
  const { prisma, adminId, certificateId } = input;
  const reason = checkReason(input.reason);
  if ("error" in reason) return { status: "invalid", errors: { reason: reason.error } };

  const existing = await prisma.certificate.findUnique({
    where: { id: certificateId },
    select: { id: true },
  });
  if (!existing) return { status: "not_found" };

  const revoking = from === "active";
  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.certificate.updateMany({
        where: { id: certificateId, status: from },
        data: revoking
          ? { status: "revoked", revokedAt: new Date(), revocationReason: reason.reason }
          : { status: "active", revokedAt: null, revocationReason: null },
      });
      if (updated.count !== 1) throw new ConflictError();
      await tx.certificateAudit.create({
        data: {
          certificateId,
          action: revoking ? "revoked" : "restored",
          reason: reason.reason,
          adminUserId: adminId,
        },
      });
    });
  } catch (error) {
    if (error instanceof ConflictError) {
      return {
        status: "wrong_state",
        message: revoking
          ? "This certificate is already revoked."
          : "This certificate is not revoked.",
      };
    }
    throw error;
  }
  return { status: "changed" };
}

export const revokeCertificate = (input: Common & { reason: string }) =>
  changeStatus(input, "active");

export const restoreCertificate = (input: Common & { reason: string }) =>
  changeStatus(input, "revoked");
