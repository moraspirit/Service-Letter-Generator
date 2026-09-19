import {
  richTextToPlainText,
  type CertificateData,
  type FieldSchema,
  type FieldValue,
} from "@moraspirit/shared";

export interface FieldChange {
  label: string;
  before: string;
  after: string;
}

const EMPTY = "(empty)";

function show(field: FieldSchema[number], value: FieldValue | undefined): string {
  if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
    return EMPTY;
  }
  if (Array.isArray(value)) return value.map((item) => `• ${item}`).join("\n");
  return field.type === "richtext" ? richTextToPlainText(value) : value;
}

/**
 * Field-by-field changes between two versions of a certificate's data, in schema
 * order, using the schema's labels. Fields that did not change are left out.
 */
export function describeChanges(
  schema: FieldSchema,
  oldData: CertificateData | null,
  newData: CertificateData | null,
): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const field of schema) {
    const before = show(field, oldData?.[field.name]);
    const after = show(field, newData?.[field.name]);
    if (before !== after) changes.push({ label: field.label, before, after });
  }
  return changes;
}
