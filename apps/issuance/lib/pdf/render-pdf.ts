// Renders a certificate to a one-page PDF. The only PDF path in the system: used to
// prove a certificate fits before it is issued, and again on every download.
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { renderCertificateHtml } from "@moraspirit/certificate-render";
import { createDataUriResolver } from "@moraspirit/certificate-render/node";
import type { CertificateData, FieldSchema } from "@moraspirit/shared";
import { qrDataUri } from "../qr";
import { buildVerifyUrl } from "../verify-url";
import { withPage } from "./browser";

const RENDER_TIMEOUT_MS = 20_000;
const LETTER_POINTS = { width: 612, height: 792 };
/** Layout tolerance in CSS pixels when comparing the end of the content to its box. */
const FIT_TOLERANCE_PX = 1;

export class PdfRenderError extends Error {}

export class PageOverflowError extends PdfRenderError {
  constructor(
    message: string,
    readonly field: string | null,
  ) {
    super(message);
  }
}

export interface RenderInput {
  certificateId: string;
  templateVersion: { htmlContent: string; fieldSchema: FieldSchema };
  data: CertificateData;
}

const assetsDir = () => path.join(process.cwd(), "public", "certificate-assets");

/** The list or rich-text field holding the most text: the one to tell the admin to shorten. */
function longestField(schema: FieldSchema, data: CertificateData) {
  let best: { name: string; label: string; size: number } | null = null;
  for (const field of schema) {
    if (field.type !== "list" && field.type !== "richtext") continue;
    const value = data[field.name];
    const size = Array.isArray(value) ? value.join("").length : (value?.length ?? 0);
    if (!best || size > best.size) best = { name: field.name, label: field.label, size };
  }
  return best;
}

function overflowError(schema: FieldSchema, data: CertificateData): PageOverflowError {
  const who = schema.find((f) => f.type === "text" && f.public_summary);
  const name =
    who && typeof data[who.name] === "string" ? String(data[who.name]) : "this recipient";
  const longest = longestField(schema, data);
  const advice = longest ? ` Shorten '${longest.label}'.` : " Shorten the text.";
  return new PageOverflowError(
    `Certificate for ${name} does not fit on one page.${advice}`,
    longest?.name ?? null,
  );
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new PdfRenderError(`PDF render timed out after ${ms} ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export async function renderCertificatePdf(input: RenderInput): Promise<Uint8Array> {
  const { certificateId, templateVersion, data } = input;
  const url = buildVerifyUrl(certificateId);
  const html = renderCertificateHtml(
    { html_content: templateVersion.htmlContent, field_schema: templateVersion.fieldSchema },
    data,
    {
      resolveAsset: createDataUriResolver(assetsDir()),
      qr: { dataUri: await qrDataUri(url), url },
    },
  );

  const pdf = await withTimeout(
    withPage(async (page) => {
      // Lockdown (architecture §9): no JavaScript, and nothing but data: URIs may load.
      await page.setJavaScriptEnabled(false);
      await page.setRequestInterception(true);
      let blocked = 0;
      page.on("request", (request) => {
        const target = request.url();
        if (target.startsWith("data:") || target === "about:blank") void request.continue();
        else {
          blocked++;
          void request.abort();
        }
      });

      await page.setContent(html, { waitUntil: "load", timeout: RENDER_TIMEOUT_MS });
      if (blocked > 0) {
        throw new PdfRenderError(
          `The template tried to load ${blocked} external resource(s); only inlined assets are allowed`,
        );
      }

      // Fit check, without running any script: the template ends its text area with an
      // empty #letter-end marker; if the marker sits below the box, the text overflowed.
      const [box, end] = await Promise.all([page.$("#letter-body"), page.$("#letter-end")]);
      if (!box || !end) {
        throw new PdfRenderError("The template has no #letter-body / #letter-end markers");
      }
      const [boxRect, endRect] = await Promise.all([box.boundingBox(), end.boundingBox()]);
      if (!boxRect || !endRect)
        throw new PdfRenderError("Could not measure the certificate layout");
      if (endRect.y > boxRect.y + boxRect.height + FIT_TOLERANCE_PX) {
        throw overflowError(templateVersion.fieldSchema, data);
      }

      return page.pdf({
        preferCSSPageSize: true,
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        timeout: RENDER_TIMEOUT_MS,
      });
    }),
    RENDER_TIMEOUT_MS + 5_000,
  );

  // Second guard: the produced file itself must be exactly one US Letter page.
  const doc = await PDFDocument.load(pdf);
  if (doc.getPageCount() !== 1) throw overflowError(templateVersion.fieldSchema, data);
  const { width, height } = doc.getPage(0).getSize();
  if (Math.abs(width - LETTER_POINTS.width) > 1 || Math.abs(height - LETTER_POINTS.height) > 1) {
    throw new PdfRenderError(`Unexpected page size ${width}x${height} pt; expected US Letter`);
  }
  return pdf;
}
