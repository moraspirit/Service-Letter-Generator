// The full certificate as one HTML document for the sandboxed iframe. Same render function as
// the PDF and the admin preview, so the three cannot drift apart. Letterhead and fonts stay as
// /certificate-assets/... paths, served by this app's own public folder (never the VPS).
import QRCode from "qrcode";
import { renderCertificateHtml } from "@moraspirit/certificate-render";
import type { CertificateData, FieldSchema } from "@moraspirit/shared";

export function verifyUrlFor(
  id: string,
  base: string | undefined = process.env.VERIFY_BASE_URL,
): string | null {
  const trimmed = base?.trim().replace(/\/+$/, "");
  return trimmed ? `${trimmed}/verify/${id}` : null;
}

export async function renderFullCertificate(input: {
  id: string;
  htmlContent: string;
  fieldSchema: FieldSchema;
  data: CertificateData;
}): Promise<string> {
  const url = verifyUrlFor(input.id);
  // Without a base URL the template draws its placeholder box instead of a QR code.
  const qr = url
    ? {
        url,
        dataUri: await QRCode.toDataURL(url, {
          errorCorrectionLevel: "M",
          margin: 1,
          width: 512,
          type: "image/png",
        }),
      }
    : undefined;
  return renderCertificateHtml(
    { html_content: input.htmlContent, field_schema: input.fieldSchema },
    input.data,
    { qr },
  );
}
