import { formatDate } from "@moraspirit/certificate-render";
import type { CertificateData, FieldSchema } from "@moraspirit/shared";

export interface SummaryRow {
  label: string;
  value: string;
}

/**
 * Only the fields the template flags `public_summary`. Narrative fields (rich text, lists) are
 * never part of the summary, whatever the flag says: they are only shown in the full certificate.
 */
export function buildSummary(schema: FieldSchema, data: CertificateData): SummaryRow[] {
  return schema.flatMap((field) => {
    if (!field.public_summary || field.type === "richtext" || field.type === "list") return [];
    const value = data[field.name];
    if (typeof value !== "string" || value === "") return [];
    return [{ label: field.label, value: field.type === "date" ? formatDate(value) : value }];
  });
}
