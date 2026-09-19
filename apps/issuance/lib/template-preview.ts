// Renders a stored template version with fabricated sample data for the admin
// preview. Same render path as the PDF: assets are inlined as data URIs, so the
// preview needs no network access and works inside a script-less sandboxed iframe.
import path from "node:path";
import { renderCertificateHtml } from "@moraspirit/certificate-render";
import { createDataUriResolver } from "@moraspirit/certificate-render/node";
import { loadAllTemplates } from "@moraspirit/certificate-templates";
import {
  buildZodSchema,
  sampleDataFromSchema,
  type CertificateData,
  type FieldSchema,
} from "@moraspirit/shared";

const ASSETS_DIR = path.join(process.cwd(), "public", "certificate-assets");

function sampleFor(slug: string, fieldSchema: FieldSchema): CertificateData {
  // Prefer the hand-written sample.json from the template folder, but only if it
  // still fits this (possibly older) version's schema.
  const fromFolder = loadAllTemplates().find((t) => t.slug === slug)?.sampleData;
  if (fromFolder && buildZodSchema(fieldSchema).safeParse(fromFolder).success) return fromFolder;
  return sampleDataFromSchema(fieldSchema);
}

export function renderVersionPreview(
  slug: string,
  version: { htmlContent: string; fieldSchema: unknown },
): string {
  const fieldSchema = version.fieldSchema as FieldSchema;
  return renderCertificateHtml(
    { html_content: version.htmlContent, field_schema: fieldSchema },
    sampleFor(slug, fieldSchema),
    { resolveAsset: createDataUriResolver(ASSETS_DIR) },
  );
}
