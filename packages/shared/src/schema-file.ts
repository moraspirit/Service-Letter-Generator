import { z } from "zod";
import type { CertificateData, FieldSchema, TemplateSchemaFile } from "./field-schema";

const fieldBase = {
  name: z.string().regex(/^[a-z][a-z0-9_]*$/, "field names are lower snake_case"),
  label: z.string().min(1),
  required: z.boolean(),
  public_summary: z.boolean().optional(),
  dedupe: z.boolean().optional(),
  default: z.string().optional(),
};

const fieldDefinition = z.discriminatedUnion("type", [
  z.object({ ...fieldBase, type: z.literal("text") }).strict(),
  z.object({ ...fieldBase, type: z.literal("date") }).strict(),
  z.object({ ...fieldBase, type: z.literal("richtext") }).strict(),
  z.object({ ...fieldBase, type: z.literal("list") }).strict(),
  z
    .object({ ...fieldBase, type: z.literal("select"), options: z.array(z.string().min(1)).min(1) })
    .strict(),
]);

const schemaFile = z
  .object({ name: z.string().min(1), fields: z.array(fieldDefinition).min(1) })
  .strict()
  .superRefine((file, ctx) => {
    const seen = new Set<string>();
    for (const field of file.fields) {
      if (seen.has(field.name)) {
        ctx.addIssue({ code: "custom", message: `duplicate field name "${field.name}"` });
      }
      seen.add(field.name);
      if (field.type === "list" && field.default !== undefined) {
        ctx.addIssue({
          code: "custom",
          message: `list field "${field.name}" cannot have a default`,
        });
      }
    }
  });

/** Validates untrusted `schema.json` content (used by the publish script and tests). */
export function parseTemplateSchemaFile(input: unknown): TemplateSchemaFile {
  return schemaFile.parse(input) as TemplateSchemaFile;
}

/** Fills fields that are missing or blank with their schema `default`. Returns a new object. */
export function applyDefaults(schema: FieldSchema, data: CertificateData): CertificateData {
  const out: CertificateData = { ...data };
  for (const field of schema) {
    if (field.default === undefined) continue;
    const value = out[field.name];
    if (value === undefined || (typeof value === "string" && value.trim() === "")) {
      out[field.name] = field.default;
    }
  }
  return out;
}
