import type { CertificateData, FieldSchema } from "./field-schema";
import { parseListCell } from "./list-parser";
import { applyDefaults } from "./schema-file";
import { buildZodSchema } from "./zod-schema";

/** Raw values as typed into the form (or read from a spreadsheet cell): everything is a string. */
export type RawValues = Record<string, string | undefined>;

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Turns what an admin types into a rich-text field into HTML: every character is
 * escaped, a blank line starts a new paragraph and a single line break becomes
 * `<br>`. The server still runs the result through the sanitizer as a backstop.
 */
export function plainTextToRichText(text: string): string {
  const paragraphs = text
    .replace(/\r\n|\r/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  return paragraphs
    .map((p) => `<p>${p.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/**
 * Converts raw strings into typed certificate data according to the schema:
 * lists are split into items, rich text is converted to HTML, blank text/date/select
 * values are omitted (so a schema `default` can fill them), and defaults are applied.
 * Keys that are not in the schema are ignored.
 */
export function dataFromRawValues(schema: FieldSchema, raw: RawValues): CertificateData {
  const data: CertificateData = {};
  for (const field of schema) {
    const value = raw[field.name] ?? "";
    switch (field.type) {
      case "list":
        data[field.name] = parseListCell(value);
        break;
      case "richtext": {
        const html = plainTextToRichText(value);
        if (html) data[field.name] = html;
        break;
      }
      default: {
        const trimmed = value.trim();
        if (trimmed) data[field.name] = trimmed;
      }
    }
  }
  return applyDefaults(schema, data);
}

export type ValidationResult =
  { ok: true; data: CertificateData } | { ok: false; errors: Record<string, string> };

/** Field-level validation with readable messages (required first, then format rules). */
export function validateCertificateData(
  schema: FieldSchema,
  data: CertificateData,
): ValidationResult {
  const errors: Record<string, string> = {};
  for (const field of schema) {
    const value = data[field.name];
    const empty = value === undefined || (Array.isArray(value) ? value.length === 0 : value === "");
    if (field.required && empty) errors[field.name] = `${field.label} is required`;
  }

  const parsed = buildZodSchema(schema).safeParse(data);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const name = String(issue.path[0] ?? "");
      if (name && !errors[name]) errors[name] = issue.message;
    }
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, data: parsed.data as CertificateData };
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&#x27;": "'",
};

/**
 * The reverse of `plainTextToRichText`, for pre-filling the edit form: paragraphs
 * become blank-line-separated text, `<br>` a line break, entities are unescaped and
 * any other tag is dropped (keeping its text).
 */
export function richTextToPlainText(html: string): string {
  return html
    .replace(/<\/p>\s*<p>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(li|ul|ol)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(?:amp|lt|gt|quot|#39|#x27);/g, (e) => ENTITIES[e] ?? e)
    .trim();
}
