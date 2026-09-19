import { createHash } from "node:crypto";
import type { CertificateData, FieldSchema } from "@moraspirit/shared";

/**
 * SHA-256 of the template id plus the normalized (trimmed, lower-cased) values of
 * the fields flagged `dedupe: true`, in schema order. Keyed on the template, not the
 * version, so a re-published template still recognizes earlier certificates.
 * Same formula as the development seed script.
 */
export function computeDedupeKey(
  templateId: number,
  schema: FieldSchema,
  data: CertificateData,
): string {
  const values = schema
    .filter((field) => field.dedupe)
    .map((field) => {
      const value = data[field.name];
      return Array.isArray(value) ? value.join("\n") : (value ?? "");
    });
  return createHash("sha256")
    .update([templateId, ...values].map((v) => String(v).trim().toLowerCase()).join("|"))
    .digest("hex");
}
