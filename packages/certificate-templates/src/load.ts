// Node-only: reads the template folders and computes what templates:publish stores.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseTemplateSchemaFile,
  type CertificateData,
  type FieldSchema,
} from "@moraspirit/shared";

export const TEMPLATES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export interface LoadedTemplate {
  /** Folder name; the stable key stored in `templates.slug`. */
  slug: string;
  /** Human-readable name from schema.json; stored in `templates.name`. */
  name: string;
  htmlContent: string;
  fieldSchema: FieldSchema;
  /** SHA-256 over the HTML and the canonical (key-sorted) field schema. */
  contentHash: string;
  /** Fabricated data for previews. */
  sampleData: CertificateData;
}

/** JSON with object keys sorted, so reformatting a file never changes its hash. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function computeContentHash(htmlContent: string, fieldSchema: FieldSchema): string {
  return createHash("sha256")
    .update(htmlContent)
    .update("\0")
    .update(canonicalJson(fieldSchema))
    .digest("hex");
}

export function loadTemplate(slug: string, dir: string = TEMPLATES_DIR): LoadedTemplate {
  const folder = path.join(dir, slug);
  const htmlContent = readFileSync(path.join(folder, "template.hbs"), "utf8");
  const schemaFile = parseTemplateSchemaFile(
    JSON.parse(readFileSync(path.join(folder, "schema.json"), "utf8")),
  );
  const sampleData = JSON.parse(
    readFileSync(path.join(folder, "sample.json"), "utf8"),
  ) as CertificateData;
  return {
    slug,
    name: schemaFile.name,
    htmlContent,
    fieldSchema: schemaFile.fields,
    contentHash: computeContentHash(htmlContent, schemaFile.fields),
    sampleData,
  };
}

/** Every folder that contains a template.hbs. */
export function loadAllTemplates(dir: string = TEMPLATES_DIR): LoadedTemplate[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^[a-z0-9][a-z0-9-]*$/.test(e.name))
    .filter((e) => {
      try {
        readFileSync(path.join(dir, e.name, "template.hbs"));
        return true;
      } catch {
        return false;
      }
    })
    .map((e) => loadTemplate(e.name, dir));
}
