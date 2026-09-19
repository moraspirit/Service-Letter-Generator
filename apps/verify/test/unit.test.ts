import { describe, expect, it } from "vitest";
import type { FieldSchema } from "@moraspirit/shared";
import { checkRateLimit, clientIp, getLimiter, type Limiter } from "../lib/rate-limit";
import { buildSummary } from "../lib/summary";
import { isCertificateId } from "../lib/uuid";
import { verifyUrlFor } from "../lib/render-full";

describe("isCertificateId", () => {
  it("accepts a v4 UUID and nothing else", () => {
    expect(isCertificateId("3f8f4c0e-5b7a-4d3e-9a1b-2c6d8e0f1a2b")).toBe(true);
    for (const bad of [
      "",
      "not-a-uuid",
      "3f8f4c0e-5b7a-1d3e-9a1b-2c6d8e0f1a2b", // version 1
      "3F8F4C0E-5B7A-4D3E-9A1B-2C6D8E0F1A2B", // upper case is never issued
      "3f8f4c0e-5b7a-4d3e-9a1b-2c6d8e0f1a2b'; DROP TABLE certificates;--",
      "../../etc/passwd",
    ]) {
      expect(isCertificateId(bad)).toBe(false);
    }
  });
});

describe("buildSummary", () => {
  const schema: FieldSchema = [
    { name: "member_id", label: "Member ID", type: "text", required: true },
    { name: "name", label: "Name", type: "text", required: true, public_summary: true },
    { name: "start", label: "Start date", type: "date", required: true, public_summary: true },
    { name: "story", label: "Story", type: "richtext", required: false, public_summary: true },
    { name: "points", label: "Points", type: "list", required: false, public_summary: true },
    { name: "empty", label: "Empty", type: "text", required: false, public_summary: true },
  ];

  it("shows only flagged, non-narrative, non-empty fields, with dates formatted", () => {
    const rows = buildSummary(schema, {
      member_id: "SECRET-ID",
      name: "Fake Person",
      start: "2025-04-28",
      story: "<p>narrative</p>",
      points: ["a"],
      empty: "",
    });
    expect(rows).toEqual([
      { label: "Name", value: "Fake Person" },
      { label: "Start date", value: "28th of April 2025" },
    ]);
  });
});

describe("verifyUrlFor", () => {
  it("builds the printed URL, or null without a base", () => {
    expect(verifyUrlFor("abc", "https://verify.example.com/")).toBe(
      "https://verify.example.com/verify/abc",
    );
    expect(verifyUrlFor("abc", "")).toBeNull();
    expect(verifyUrlFor("abc", undefined)).toBeNull();
  });
});

describe("clientIp", () => {
  it("takes the first X-Forwarded-For entry, then X-Real-IP", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("1.2.3.4");
    expect(clientIp(new Headers({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
    expect(clientIp(new Headers())).toBeNull();
  });
});

describe("checkRateLimit (fails open)", () => {
  const limiter = (impl: Limiter["limit"]): Limiter => ({ limit: impl });

  it("allows a request under the limit", async () => {
    const result = await checkRateLimit(
      limiter(async () => ({ success: true, reset: 0 })),
      "1.1.1.1",
    );
    expect(result).toEqual({ blocked: false });
  });

  it("blocks only on a positive over-limit answer, with Retry-After", async () => {
    const result = await checkRateLimit(
      limiter(async () => ({ success: false, reset: 31_500 })),
      "1.1.1.1",
      { now: () => 0 },
    );
    expect(result).toEqual({ blocked: true, retryAfterSeconds: 32 });
  });

  it("allows the request when Upstash errors", async () => {
    const result = await checkRateLimit(
      limiter(async () => {
        throw new Error("Upstash is down");
      }),
      "1.1.1.1",
    );
    expect(result).toEqual({ blocked: false });
  });

  it("allows the request when Upstash is slower than the timeout", async () => {
    const started = Date.now();
    const result = await checkRateLimit(
      limiter(() => new Promise(() => {})), // never answers
      "1.1.1.1",
      { timeoutMs: 50 },
    );
    expect(result).toEqual({ blocked: false });
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it("does nothing without a limiter or an IP", async () => {
    expect(await checkRateLimit(null, "1.1.1.1")).toEqual({ blocked: false });
    expect(
      await checkRateLimit(
        limiter(async () => ({ success: false, reset: 1 })),
        null,
      ),
    ).toEqual({ blocked: false });
  });
});

describe("getLimiter", () => {
  it("is off when the Upstash variables are unset", () => {
    expect(getLimiter({} as NodeJS.ProcessEnv)).toBeNull();
  });
});
