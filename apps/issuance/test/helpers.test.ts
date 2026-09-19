import { describe, expect, it } from "vitest";
import type { FieldSchema } from "@moraspirit/shared";
import { computeDedupeKey } from "../lib/dedupe";
import { sanitizeRichText } from "../lib/sanitize";
import { buildVerifyUrl, newCertificateId, UUID_PATTERN, VerifyUrlError } from "../lib/verify-url";

describe("sanitizeRichText", () => {
  it("keeps only the allowlisted tags and strips every attribute", () => {
    expect(
      sanitizeRichText('<p class="x" onclick="a()">Hi <strong>you</strong><br><em>ok</em></p>'),
    ).toBe("<p>Hi <strong>you</strong><br /><em>ok</em></p>");
    expect(sanitizeRichText("<ul><li>a</li></ul><ol><li>b</li></ol>")).toBe(
      "<ul><li>a</li></ul><ol><li>b</li></ol>",
    );
  });

  it("removes scripts, styles, links, images and iframes", () => {
    const dirty =
      '<script>alert(1)</script><style>p{}</style><a href="javascript:x()">l</a><img src=x onerror=y><iframe src=z></iframe>text';
    const clean = sanitizeRichText(dirty);
    expect(clean).not.toMatch(/<script|<style|<a |<img|<iframe|javascript|alert/);
    expect(clean).toContain("text");
  });
});

describe("computeDedupeKey", () => {
  const schema: FieldSchema = [
    { name: "member_id", label: "ID", type: "text", required: true, dedupe: true },
    { name: "name", label: "Name", type: "text", required: true },
  ];

  it("is stable, case- and whitespace-insensitive, and ignores non-dedupe fields", () => {
    const a = computeDedupeKey(1, schema, { member_id: "SPL2501", name: "A" });
    expect(computeDedupeKey(1, schema, { member_id: "  spl2501 ", name: "B" })).toBe(a);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("differs per template and per value", () => {
    const base = computeDedupeKey(1, schema, { member_id: "X" });
    expect(computeDedupeKey(2, schema, { member_id: "X" })).not.toBe(base);
    expect(computeDedupeKey(1, schema, { member_id: "Y" })).not.toBe(base);
  });
});

describe("buildVerifyUrl", () => {
  const id = newCertificateId();

  it("generates v4 UUIDs", () => {
    expect(id).toMatch(UUID_PATTERN);
  });

  it("builds the URL from the base origin, tolerating a trailing slash or path", () => {
    expect(buildVerifyUrl(id, { VERIFY_BASE_URL: "https://verify.example.org/" })).toBe(
      `https://verify.example.org/verify/${id}`,
    );
  });

  it("allows http://localhost in development only", () => {
    const dev = { VERIFY_BASE_URL: "http://localhost:3001", NODE_ENV: "development" };
    expect(buildVerifyUrl(id, dev)).toBe(`http://localhost:3001/verify/${id}`);
    expect(() => buildVerifyUrl(id, { ...dev, NODE_ENV: "production" })).toThrow(VerifyUrlError);
  });

  it("in production requires https and a public host", () => {
    const prod = { NODE_ENV: "production" };
    expect(() =>
      buildVerifyUrl(id, { ...prod, VERIFY_BASE_URL: "http://verify.example.org" }),
    ).toThrow();
    expect(() => buildVerifyUrl(id, { ...prod, VERIFY_BASE_URL: "https://localhost" })).toThrow();
    expect(() =>
      buildVerifyUrl(id, { ...prod, VERIFY_BASE_URL: "https://printer.local" }),
    ).toThrow();
    expect(
      buildVerifyUrl(id, { ...prod, VERIFY_BASE_URL: "https://verify.example.org" }),
    ).toContain(id);
  });

  it("rejects a missing or malformed base and a bad id", () => {
    expect(() => buildVerifyUrl(id, {})).toThrow(/not set/);
    expect(() => buildVerifyUrl(id, { VERIFY_BASE_URL: "not a url" })).toThrow();
    expect(() => buildVerifyUrl("nope", { VERIFY_BASE_URL: "https://a.example" })).toThrow(
      /Invalid/,
    );
  });
});
