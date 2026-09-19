import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { escapeLike, listCertificates, PAGE_SIZE } from "../lib/certificate-list";
import { revokeCertificate } from "../lib/certificate-changes";
import { issueCertificate } from "../lib/issue-certificate";
import { createFixture, type Fixture } from "./fixtures";

let f: Fixture;
let other: Fixture;
const okRender = vi.fn(async () => new Uint8Array([1]));

async function issue(fx: Fixture, member: string, name: string) {
  const result = await issueCertificate({
    prisma: fx.prisma,
    adminId: fx.adminId,
    templateId: fx.templateId,
    rawValues: { member_id: member, recipient_name: name, points: "One" },
    confirmDuplicate: true,
    renderPdf: okRender,
  });
  if (result.status !== "issued") throw new Error(result.status);
  return result.id;
}

beforeAll(async () => {
  f = await createFixture();
  other = await createFixture();
  await issue(f, "SPL2501", "Alexandra Example");
  await issue(f, "SPL2502", "Benedict Sample");
  await issue(f, "50%_OFF", "Wildcard Person");
  await issue(f, "XYZ", "Other Wildcard");
  await issue(other, "OTH1", "Alexandra Elsewhere");
});
afterAll(async () => {
  await f.cleanup();
  await other.cleanup();
});

// Both fixtures share one database with any other data, so scope every query to a fixture template.
const q = (query: Parameters<typeof listCertificates>[1]) =>
  listCertificates(f.prisma, { templateId: f.templateId, ...query });
const members = (r: Awaited<ReturnType<typeof q>>) =>
  r.items.map((i) => (i.data as Record<string, string>).member_id).sort();

describe("listCertificates", () => {
  it("searches member id and name, case-insensitively, as a contains match", async () => {
    expect(members(await q({ q: "spl25" }))).toEqual(["SPL2501", "SPL2502"]);
    expect(members(await q({ q: "  ALEXAND " }))).toEqual(["SPL2501"]);
    expect(members(await q({ q: "sample" }))).toEqual(["SPL2502"]);
    expect(members(await q({ q: "no-such-thing" }))).toEqual([]);
  });

  it("treats LIKE wildcards in the search literally", async () => {
    expect(members(await q({ q: "%" }))).toEqual(["50%_OFF"]);
    expect(members(await q({ q: "_" }))).toEqual(["50%_OFF"]);
    expect(members(await q({ q: "0%_O" }))).toEqual(["50%_OFF"]);
    expect(escapeLike("a%b_c")).toBe(String.raw`a\%b\_c`);
    expect(escapeLike(String.raw`x\y`)).toBe(String.raw`x\\y`);
  });

  it("filters by template and by status", async () => {
    expect(members(await q({}))).toHaveLength(4);
    const both = await listCertificates(f.prisma, { q: "alexandra" });
    expect(both.items.length).toBeGreaterThanOrEqual(2);
    expect(members(await listCertificates(f.prisma, { templateId: other.templateId }))).toEqual([
      "OTH1",
    ]);

    const target = (await q({ q: "SPL2502" })).items[0]!;
    await revokeCertificate({
      prisma: f.prisma,
      adminId: f.adminId,
      certificateId: target.id,
      reason: "test",
    });
    expect(members(await q({ status: "revoked" }))).toEqual(["SPL2502"]);
    expect(members(await q({ status: "active" }))).toHaveLength(3);
  });

  it("paginates newest first with a correct total", async () => {
    for (let i = 0; i < PAGE_SIZE; i++) await issue(f, `PAGE-${i}`, `Paged Person ${i}`);
    const first = await q({ q: "paged person", page: 1 });
    const second = await q({ q: "paged person", page: 2 });
    expect(first.total).toBe(PAGE_SIZE);
    expect(first.items).toHaveLength(PAGE_SIZE);
    expect(second.items).toHaveLength(0);
    expect(first.pageCount).toBe(1);

    const all = await q({ page: 1 });
    expect(all.total).toBe(4 + PAGE_SIZE);
    expect(all.items).toHaveLength(PAGE_SIZE);
    expect(all.pageCount).toBe(2);
    expect((await q({ page: 2 })).items).toHaveLength(4);
    const times = all.items.map((i) => i.issuedAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });
});
