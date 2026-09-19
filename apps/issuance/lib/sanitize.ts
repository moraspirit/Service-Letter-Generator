// Rich-text values are sanitized when they are saved (architecture §9). Templates
// are trusted code and are never passed through this.
import sanitizeHtml from "sanitize-html";
import type { CertificateData, FieldSchema } from "@moraspirit/shared";

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "strong", "em", "ul", "ol", "li"],
  allowedAttributes: {},
  // Drop disallowed tags but keep their text; script/style contents are removed entirely.
  disallowedTagsMode: "discard",
};

export const sanitizeRichText = (html: string): string => sanitizeHtml(html, OPTIONS);

/** Sanitizes every rich-text field of a data object; other fields pass through unchanged. */
export function sanitizeRichTextFields(
  schema: FieldSchema,
  data: CertificateData,
): CertificateData {
  const out: CertificateData = { ...data };
  for (const field of schema) {
    const value = out[field.name];
    if (field.type === "richtext" && typeof value === "string") {
      out[field.name] = sanitizeRichText(value);
    }
  }
  return out;
}
