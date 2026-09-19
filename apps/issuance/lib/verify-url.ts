import { randomUUID } from "node:crypto";

export class VerifyUrlError extends Error {}

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export const newCertificateId = (): string => randomUUID();

const LOCAL_HOST = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\]|.*\.local)$/i;

/**
 * The URL a certificate's QR code encodes. It is printed on paper and cannot be changed
 * afterwards, so in production it must be an explicit https URL on a real host.
 */
export function buildVerifyUrl(
  certificateId: string,
  env: { VERIFY_BASE_URL?: string; NODE_ENV?: string } = process.env,
): string {
  if (!UUID_PATTERN.test(certificateId)) throw new VerifyUrlError("Invalid certificate id");
  const raw = env.VERIFY_BASE_URL?.trim();
  if (!raw) throw new VerifyUrlError("VERIFY_BASE_URL is not set");

  let base: URL;
  try {
    base = new URL(raw);
  } catch {
    throw new VerifyUrlError("VERIFY_BASE_URL is not a valid URL");
  }
  if (env.NODE_ENV === "production") {
    if (base.protocol !== "https:")
      throw new VerifyUrlError("VERIFY_BASE_URL must be https in production");
    if (LOCAL_HOST.test(base.hostname)) {
      throw new VerifyUrlError(
        "VERIFY_BASE_URL must be the public domain in production, not a local host",
      );
    }
  } else if (base.protocol !== "https:" && base.protocol !== "http:") {
    throw new VerifyUrlError("VERIFY_BASE_URL must be an http(s) URL");
  }
  return `${base.origin}/verify/${certificateId}`;
}
