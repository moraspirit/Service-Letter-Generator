// The lookups behind the verify page. A revoked certificate is answered from its status row
// alone: its data and template are never read, so they cannot leak into the response.
import type { PrismaClient } from "@moraspirit/db";
import type { CertificateData, FieldSchema } from "@moraspirit/shared";

export type LoadedCertificate =
  | { kind: "not_found" }
  | { kind: "revoked"; revokedAt: Date | null }
  | {
      kind: "active";
      issuedAt: Date;
      data: CertificateData;
      fieldSchema: FieldSchema;
      /** Only loaded for the full-certificate view. */
      htmlContent: string | null;
    };

export async function loadCertificate(
  prisma: PrismaClient,
  id: string,
  options: { withHtml: boolean },
): Promise<LoadedCertificate> {
  // Twice at most: if the certificate is revoked between the two reads, the second pass sees it.
  for (let attempt = 0; attempt < 2; attempt++) {
    const head = await prisma.certificate.findUnique({
      where: { id },
      select: { status: true, revokedAt: true },
    });
    if (!head) return { kind: "not_found" };
    if (head.status === "revoked") return { kind: "revoked", revokedAt: head.revokedAt };

    const row = await prisma.certificate.findFirst({
      where: { id, status: "active" },
      select: {
        issuedAt: true,
        data: true,
        templateVersion: {
          select: { fieldSchema: true, ...(options.withHtml ? { htmlContent: true } : {}) },
        },
      },
    });
    if (!row) continue;
    const version = row.templateVersion as { fieldSchema: unknown; htmlContent?: string };
    return {
      kind: "active",
      issuedAt: row.issuedAt,
      data: row.data as unknown as CertificateData,
      fieldSchema: version.fieldSchema as unknown as FieldSchema,
      htmlContent: options.withHtml ? (version.htmlContent ?? null) : null,
    };
  }
  return { kind: "not_found" };
}
