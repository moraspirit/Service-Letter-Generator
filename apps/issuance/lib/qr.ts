import QRCode from "qrcode";

/** A PNG data URI for the given URL, ready to inline into the certificate HTML. */
export function qrDataUri(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 512,
    type: "image/png",
  });
}
