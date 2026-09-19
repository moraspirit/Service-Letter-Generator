import { afterAll, describe, expect, it } from "vitest";
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFRef,
  decodePDFRawStream,
} from "pdf-lib";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { loadTemplate } from "@moraspirit/certificate-templates";
import { applyDefaults, type CertificateData } from "@moraspirit/shared";
import "./env";
import { closeBrowser } from "../lib/pdf/browser";
import { PageOverflowError, PdfRenderError, renderCertificatePdf } from "../lib/pdf/render-pdf";
import { qrDataUri } from "../lib/qr";
import { buildVerifyUrl, newCertificateId } from "../lib/verify-url";

afterAll(() => closeBrowser());

const SLUGS = ["moraspirit-service-letter", "moraspirit-service-letter-outstanding"];

function versionFor(slug: string) {
  const t = loadTemplate(slug);
  return {
    version: { htmlContent: t.htmlContent, fieldSchema: t.fieldSchema },
    data: applyDefaults(t.fieldSchema, t.sampleData),
  };
}

/** Everything about a PDF that this test cares about, read without running any script. */
async function inspect(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes);
  const page = doc.getPage(0);
  const resources = page.node.Resources() as PDFDict;
  const fonts = resources.lookup(PDFName.of("Font"), PDFDict);
  const fontInfo = fonts.keys().map((key) => {
    const font = fonts.lookup(key, PDFDict);
    const base = font.lookup(PDFName.of("BaseFont"))?.toString() ?? "";
    // Type0 fonts point at a descendant font that owns the descriptor.
    const descendant = font.lookup(PDFName.of("DescendantFonts"), PDFArray)?.lookup(0, PDFDict);
    const descriptor = (descendant ?? font).lookup(PDFName.of("FontDescriptor"), PDFDict);
    const embedded = ["FontFile", "FontFile2", "FontFile3"].some((k) =>
      descriptor.has(PDFName.of(k)),
    );
    return { base, embedded };
  });
  const xobjects = resources.lookup(PDFName.of("XObject"), PDFDict);
  const images = xobjects.keys().filter((key) => {
    const ref = xobjects.get(key);
    const stream = ref instanceof PDFRef ? doc.context.lookup(ref) : ref;
    return (
      stream instanceof PDFRawStream &&
      stream.dict.get(PDFName.of("Subtype"))?.toString() === "/Image"
    );
  });

  const contents = page.node.Contents();
  const streams: string[] = [];
  const collect = (obj: unknown) => {
    const resolved = obj instanceof PDFRef ? doc.context.lookup(obj) : obj;
    if (resolved instanceof PDFRawStream) {
      streams.push(Buffer.from(decodePDFRawStream(resolved).decode()).toString("latin1"));
    } else if (resolved instanceof PDFArray) {
      resolved.asArray().forEach(collect);
    }
  };
  collect(contents);
  const content = streams.join("\n");

  return {
    pages: doc.getPageCount(),
    size: page.getSize(),
    fontInfo,
    imageCount: images.length,
    hasTextOperators: /\b(TJ|Tj)\b/.test(content),
    content,
  };
}

describe.each(SLUGS)("renderCertificatePdf — %s", (slug) => {
  const { version, data } = versionFor(slug);

  it("produces one US Letter page with selectable text and the bundled font embedded", async () => {
    const pdf = await renderCertificatePdf({
      certificateId: newCertificateId(),
      templateVersion: version,
      data,
    });
    expect(Buffer.from(pdf.slice(0, 5)).toString()).toBe("%PDF-");

    const info = await inspect(pdf);
    expect(info.pages).toBe(1);
    expect(info.size.width).toBeCloseTo(612, 0);
    expect(info.size.height).toBeCloseTo(792, 0);
    expect(info.hasTextOperators).toBe(true); // vector text, not an image
    expect(info.fontInfo.length).toBeGreaterThan(0);
    expect(info.fontInfo.every((f) => f.embedded)).toBe(true);
    expect(info.fontInfo.some((f) => f.base.includes("LiberationSerif"))).toBe(true);
    expect(info.imageCount).toBeGreaterThanOrEqual(2); // letterhead + QR code
  });

  it("fails with a clear error naming the field, and returns no PDF, when the text overflows", async () => {
    const long = Array.from(
      { length: 40 },
      (_, i) =>
        `Bullet ${i} with quite a lot of text so that the list cannot possibly fit on the page.`,
    );
    const overflowing: CertificateData = { ...data, special_points: long };
    const attempt = renderCertificatePdf({
      certificateId: newCertificateId(),
      templateVersion: version,
      data: overflowing,
    });
    await expect(attempt).rejects.toBeInstanceOf(PageOverflowError);
    await expect(attempt).rejects.toThrow(/does not fit on one page\. Shorten 'Special Points'/);
  });
});

describe("renderCertificatePdf — safety", () => {
  const { version, data } = versionFor(SLUGS[0]!);

  it("refuses a template that tries to load an external resource", async () => {
    const bad = {
      ...version,
      htmlContent: version.htmlContent.replace(
        '<div id="letter-body">',
        '<img src="https://example.invalid/x.png"><div id="letter-body">',
      ),
    };
    await expect(
      renderCertificatePdf({ certificateId: newCertificateId(), templateVersion: bad, data }),
    ).rejects.toThrow(PdfRenderError);
  });

  it("does not run script even if a template contains it", async () => {
    // If this script ran it would add 100 paragraphs and the letter would overflow.
    // JavaScript is disabled, so it must be ignored and the render must succeed.
    const sneaky = {
      ...version,
      htmlContent: version.htmlContent.replace(
        "</body>",
        "<script>for (var i = 0; i < 100; i++) { var p = document.createElement('p'); p.textContent = 'x'; var e = document.getElementById('letter-end'); e.parentNode.insertBefore(p, e); }</script></body>",
      ),
    };
    const pdf = await renderCertificatePdf({
      certificateId: newCertificateId(),
      templateVersion: sneaky,
      data,
    });
    expect((await inspect(pdf)).pages).toBe(1);
  });

  it("renders the same content with all network traffic blocked (nothing is fetched at render time)", async () => {
    const id = newCertificateId();
    const online = await inspect(
      await renderCertificatePdf({ certificateId: id, templateVersion: version, data }),
    );

    await closeBrowser();
    process.env.CHROMIUM_EXTRA_ARGS = "--proxy-server=127.0.0.1:1"; // every network request now fails
    try {
      const offline = await inspect(
        await renderCertificatePdf({ certificateId: id, templateVersion: version, data }),
      );
      expect(offline.pages).toBe(1);
      expect(offline.content).toBe(online.content);
      expect(offline.fontInfo).toEqual(online.fontInfo);
    } finally {
      delete process.env.CHROMIUM_EXTRA_ARGS;
      await closeBrowser();
    }
  });
});

describe("QR code", () => {
  it("decodes to the verification URL for the certificate's UUID", async () => {
    const id = newCertificateId();
    const url = buildVerifyUrl(id);
    const dataUri = await qrDataUri(url);
    const png = PNG.sync.read(Buffer.from(dataUri.split(",")[1]!, "base64"));
    const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    expect(decoded?.data).toBe(url);
    expect(url.endsWith(`/verify/${id}`)).toBe(true);
  });
});
