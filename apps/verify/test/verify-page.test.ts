// The verify page against the Aiven test database, connecting as verify_ro like production.
import { randomUUID } from "node:crypto";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createPrismaClient, type PrismaClient } from "@moraspirit/db";
import { MEMBER_ID, NARRATIVE, RECIPIENT, REVOKE_REASON, seed, type Seed } from "./seed";

vi.mock("@/lib/db", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lib/db")>();
  return { getDb: vi.fn(original.getDb) };
});

import { getDb } from "@/lib/db";
import VerifyPage from "../app/verify/[uuid]/page";

let fixture: Seed;

async function render(uuid: string, search: { full?: string } = {}): Promise<string> {
  const element = await VerifyPage({
    params: Promise.resolve({ uuid }),
    searchParams: Promise.resolve(search),
  });
  return renderToStaticMarkup(element);
}

async function notFoundFor(uuid: string): Promise<boolean> {
  try {
    await render(uuid);
    return false;
  } catch (error) {
    return (error as { digest?: string }).digest === "NEXT_HTTP_ERROR_FALLBACK;404";
  }
}

beforeAll(async () => {
  fixture = await seed();
});
afterAll(async () => {
  await fixture.cleanup();
});

describe("not found", () => {
  it("returns 404 for a malformed id without touching the database", async () => {
    vi.mocked(getDb).mockClear();
    for (const bad of ["nope", "../etc/passwd", "3f8f4c0e-5b7a-1d3e-9a1b-2c6d8e0f1a2b"]) {
      expect(await notFoundFor(bad)).toBe(true);
    }
    expect(getDb).not.toHaveBeenCalled();
  });

  it("returns 404 for a well-formed id that does not exist", async () => {
    expect(await notFoundFor(randomUUID())).toBe(true);
  });
});

describe("revoked", () => {
  it("shows the status and date, and none of the content or the reason", async () => {
    const html = await render(fixture.revokedId, { full: "1" }); // even when the full view is asked for
    expect(html).toContain("This certificate has been revoked");
    expect(html).toContain("1st of June 2025");
    for (const secret of [RECIPIENT, MEMBER_ID, NARRATIVE, REVOKE_REASON, "<iframe", "Verified"]) {
      expect(html).not.toContain(secret);
    }
  });
});

describe("active", () => {
  it("opens on the verdict, the public summary and the full letter", async () => {
    const html = await render(fixture.activeId);
    expect(html).toContain("Verified — Authentic");
    expect(html).toContain(RECIPIENT);
    expect(html).toContain("28th of April 2025");
    expect(html).toContain("Active");
    expect(html).toContain(NARRATIVE); // the letter is inside srcdoc
    expect(html).toContain("/certificate-assets/mora-letterhead-v1.jpg");
    // The summary rail lists only public_summary fields; the member id is not one of them.
    expect(html.split("<iframe")[0]).not.toContain(MEMBER_ID);
  });

  it("puts the letter in a sandbox that allows no scripts", async () => {
    const html = await render(fixture.activeId);
    expect(html).toContain("<iframe");
    expect(html).toMatch(/sandbox=""/);
    expect(html).not.toContain("allow-scripts");
  });

  it("shows the same page for ?full=1, so old links keep working", async () => {
    expect(await render(fixture.activeId, { full: "1" })).toBe(await render(fixture.activeId));
  });

  it("no longer offers a separate full-certificate view", async () => {
    const html = await render(fixture.activeId);
    expect(html).not.toContain("View full certificate");
    expect(html).not.toContain("Hide the full certificate");
    expect(html).not.toContain("?full=1");
  });
});

describe("verify_ro", () => {
  let readOnly: PrismaClient;
  beforeAll(() => {
    readOnly = createPrismaClient({ connectionLimit: 1 });
  });
  afterAll(async () => {
    await readOnly.$disconnect();
  });

  it("can read certificates but cannot write", async () => {
    expect(
      await readOnly.certificate.findUnique({ where: { id: fixture.activeId } }),
    ).not.toBeNull();
    await expect(
      readOnly.certificate.update({ where: { id: fixture.activeId }, data: { status: "revoked" } }),
    ).rejects.toThrow();
    await expect(
      readOnly.certificate.delete({ where: { id: fixture.activeId } }),
    ).rejects.toThrow();
  });

  it("cannot read the private tables", async () => {
    await expect(readOnly.adminUser.findMany()).rejects.toThrow();
    await expect(readOnly.certificateAudit.findMany()).rejects.toThrow();
    await expect(readOnly.importBatch.findMany()).rejects.toThrow();
    await expect(readOnly.loginAttempt.findMany()).rejects.toThrow();
  });
});
