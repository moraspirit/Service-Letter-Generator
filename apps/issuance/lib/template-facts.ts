import type { FieldSchema } from "@moraspirit/shared";

/** The facts a template card shows, derived from its own schema. */
export function templateFacts(
  version: { versionNumber: number; fieldSchema: unknown },
  issued: number,
): { label: string; value: string }[] {
  const fields = version.fieldSchema as FieldSchema;
  const toFill = fields.filter((f) => f.required && f.default === undefined).length;
  const sections = fields
    .filter((f) => f.type === "list" || f.type === "richtext")
    .map((f) => (f.required ? f.label : `${f.label} (optional)`));

  return [
    { label: "Current version", value: `v${version.versionNumber}` },
    { label: "Fields", value: `${fields.length} (${toFill} to fill in)` },
    { label: "Issued so far", value: String(issued) },
    ...(sections.length > 0 ? [{ label: "Written sections", value: sections.join(", ") }] : []),
  ];
}
