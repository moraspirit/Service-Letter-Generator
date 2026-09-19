// Structural guard for "no code path changes a certificate without an audit row":
// only these modules may write to the certificates table, and each of them writes its
// audit row in the same transaction (proved by certificate-changes.test.ts and
// issue-certificate.test.ts). A new writer anywhere else fails this test.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");
const ALLOWED = new Set([
  "lib/issue-certificate.ts",
  "lib/certificate-changes.ts",
  "lib/import/commit-import.ts",
]);
const SKIP = new Set(["node_modules", ".next", "test", "public"]);
const WRITE =
  /\b(?:prisma|tx|db)\.certificate\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\b/;
const RAW_WRITE = /(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+`?certificates`?\b/i;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (SKIP.has(name)) return [];
    if (statSync(full).isDirectory()) return sources(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

describe("certificate writes", () => {
  it("only happen in the audited modules", () => {
    const offenders = sources(ROOT)
      .map((file) => ({
        rel: path.relative(ROOT, file).split(path.sep).join("/"),
        text: readFileSync(file, "utf8"),
      }))
      .filter(({ rel, text }) => !ALLOWED.has(rel) && (WRITE.test(text) || RAW_WRITE.test(text)))
      .map(({ rel }) => rel);
    expect(offenders).toEqual([]);
  });

  it("the audited modules also write an audit row", () => {
    for (const rel of ALLOWED) {
      expect(readFileSync(path.join(ROOT, rel), "utf8")).toMatch(/certificateAudit\.create/);
    }
  });
});
