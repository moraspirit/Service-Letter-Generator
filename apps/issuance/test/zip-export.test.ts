// The ZIP export's plain functions against the Aiven test database, with a fake renderer and a
// scratch EXPORT_DIR. Includes a crash halfway followed by a re-run.
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PageOverflowError, type RenderInput } from "../lib/pdf/render-pdf";
import {
  assignFileNames,
  cleanupExpired,
  failExport,
  finalizeExport,
  listExportableIds,
  markGenerating,
  recordProgress,
  renderCertificateToFile,
  requestExport,
  type RenderOutcome,
} from "../lib/export/zip-export";
import { batchDir, zipFile } from "../lib/export/paths";
import { createFixture, type Fixture } from "./fixtures";

/** Reads the entry names out of a ZIP's central directory, proving the archive is complete. */
function zipNames(file: string): string[] {
  const buf = readFileSync(file);
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not a zip");
  const count = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);
  const names: string[] = [];
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(offset) !== 0x02014b50) throw new Error("bad central directory");
    const nameLength = buf.readUInt16LE(offset + 28);
    const extraLength = buf.readUInt16LE(offset + 30);
    const commentLength = buf.readUInt16LE(offset + 32);
    names.push(buf.toString("utf8", offset + 46, offset + 46 + nameLength));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return names.sort();
}

let fx: Fixture;
let root: string;
const okRender = vi.fn(async () => new Uint8Array([37, 80, 68, 70]));
const batches: number[] = [];

async function makeBatch(count: number, members?: string[]) {
  const batch = await fx.prisma.importBatch.create({
    data: {
      templateVersionId: fx.versionId,
      fileName: "fake.xlsx",
      fileType: "xlsx",
      fileHash: randomBytes(32).toString("hex"),
      rowCount: count,
      insertedCount: count,
      adminUserId: fx.adminId,
    },
  });
  batches.push(batch.id);
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const cert = await fx.prisma.certificate.create({
      data: {
        id: randomUUID(),
        templateVersionId: fx.versionId,
        importBatchId: batch.id,
        dedupeKey: randomBytes(32).toString("hex"),
        data: {
          member_id: members?.[i] ?? `M${i + 1}`,
          recipient_name: `Person ${i}`,
          points: ["x"],
        },
      },
    });
    ids.push(cert.id);
  }
  return { batchId: batch.id, ids };
}

/** What the Inngest function does, minus Inngest. */
async function runJob(
  batchId: number,
  render: (input: RenderInput) => Promise<Uint8Array> = okRender,
  only?: (id: string, index: number) => boolean,
) {
  await markGenerating(fx.prisma, batchId);
  const ids = await listExportableIds(fx.prisma, batchId);
  const outcomes: RenderOutcome[] = [];
  for (const [i, certificateId] of ids.entries()) {
    if (only && !only(certificateId, i)) continue;
    outcomes.push(
      await renderCertificateToFile({
        prisma: fx.prisma,
        batchId,
        certificateId,
        renderPdf: render,
      }),
    );
    await recordProgress(fx.prisma, batchId);
  }
  return outcomes;
}

beforeAll(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "zip-export-"));
  process.env.EXPORT_DIR = root;
  fx = await createFixture();
});

afterAll(async () => {
  await fx.prisma.certificate.deleteMany({ where: { importBatchId: { in: batches } } });
  await fx.prisma.importBatch.deleteMany({ where: { id: { in: batches } } });
  await fx.cleanup();
  await rm(root, { recursive: true, force: true });
});

describe("assignFileNames", () => {
  it("uses the member id, and adds the certificate id for unsafe or repeated ones", () => {
    const names = assignFileNames([
      { id: "aaaaaaaa-1111", data: { member_id: "SPL1" } },
      { id: "bbbbbbbb-2222", data: { member_id: "SPL2" } },
      { id: "cccccccc-3333", data: { member_id: "SPL2" } },
      { id: "dddddddd-4444", data: { member_id: "../evil name" } },
      { id: "eeeeeeee-5555", data: {} },
    ]);
    expect([...names.values()].sort()).toEqual([
      "certificate-SPL1.pdf",
      "certificate-SPL2-bbbbbbbb.pdf",
      "certificate-SPL2-cccccccc.pdf",
      "certificate-dddddddd.pdf",
      "certificate-eeeeeeee.pdf",
    ]);
  });

  it("is the same on every call, so a retry writes the same names", () => {
    const input = [
      { id: "b", data: { member_id: "X" } },
      { id: "a", data: { member_id: "X" } },
    ];
    expect(Object.fromEntries(assignFileNames(input))).toEqual(
      Object.fromEntries(assignFileNames([...input].reverse())),
    );
  });
});

describe("a full export", () => {
  it("renders every active certificate, zips them and records the batch state", async () => {
    const { batchId, ids } = await makeBatch(3);
    expect(await requestExport(fx.prisma, batchId)).toEqual({ started: true });
    const outcomes = await runJob(batchId);
    const result = await finalizeExport(fx.prisma, batchId, outcomes);
    expect(result).toEqual({ status: "ready", included: 3, reportCount: 0 });

    expect(zipNames(zipFile(batchId))).toEqual([
      "certificate-M1.pdf",
      "certificate-M2.pdf",
      "certificate-M3.pdf",
    ]);
    expect(existsSync(batchDir(batchId))).toBe(false); // folder removed once zipped
    const batch = await fx.prisma.importBatch.findUniqueOrThrow({ where: { id: batchId } });
    expect(batch).toMatchObject({
      zipStatus: "ready",
      zipRenderedCount: 3,
      zipPath: `${batchId}.zip`,
    });
    expect(batch.zipExpiresAt!.getTime() - Date.now()).toBeGreaterThan(23.9 * 3600_000);
    expect(ids).toHaveLength(3);
  });

  it("leaves out revoked certificates and says so in the report", async () => {
    const { batchId, ids } = await makeBatch(3);
    await fx.prisma.certificate.update({
      where: { id: ids[1]! },
      data: { status: "revoked", revokedAt: new Date(), revocationReason: "test" },
    });
    await requestExport(fx.prisma, batchId);
    const result = await finalizeExport(fx.prisma, batchId, await runJob(batchId));
    expect(result).toMatchObject({ status: "ready", included: 2, reportCount: 1 });
    const batch = await fx.prisma.importBatch.findUniqueOrThrow({ where: { id: batchId } });
    expect(batch.zipReport).toEqual([
      { certificateId: ids[1], memberId: "M2", reason: "Revoked, so left out of the ZIP." },
    ]);
    expect(zipNames(zipFile(batchId))).toEqual(["certificate-M1.pdf", "certificate-M3.pdf"]);
  });

  it("reports a letter that does not fit while the rest still build", async () => {
    const { batchId, ids } = await makeBatch(3);
    const render = vi.fn(async (input: RenderInput) => {
      if (input.certificateId === ids[0]) {
        throw new PageOverflowError(
          "Certificate for Someone does not fit. Shorten 'Points'.",
          "points",
        );
      }
      return new Uint8Array([1]);
    });
    await requestExport(fx.prisma, batchId);
    const result = await finalizeExport(fx.prisma, batchId, await runJob(batchId, render));
    expect(result).toMatchObject({ status: "ready", included: 2, reportCount: 1 });
    const batch = await fx.prisma.importBatch.findUniqueOrThrow({ where: { id: batchId } });
    const report = batch.zipReport as { reason: string }[];
    expect(report[0]!.reason).toBe("Does not fit on one page. Shorten 'Points'.");
    expect(JSON.stringify(report)).not.toContain("Someone"); // no recipient names in the report
  });

  it("fails the batch, with no ZIP, when nothing could be rendered", async () => {
    const { batchId } = await makeBatch(2);
    const render = vi.fn(async () => {
      throw new Error("boom with Person 0");
    });
    await requestExport(fx.prisma, batchId);
    const result = await finalizeExport(fx.prisma, batchId, await runJob(batchId, render));
    expect(result.status).toBe("failed");
    expect(existsSync(zipFile(batchId))).toBe(false);
    const batch = await fx.prisma.importBatch.findUniqueOrThrow({ where: { id: batchId } });
    expect(batch.zipStatus).toBe("failed");
    expect(JSON.stringify(batch.zipReport)).not.toContain("Person");
  });
});

describe("a crash halfway followed by a re-run", () => {
  it("ends with exactly one file per certificate and a complete ZIP", async () => {
    const { batchId } = await makeBatch(6);
    await requestExport(fx.prisma, batchId);

    // The job dies after 3 of 6, leaving a half-written PDF and a half-written ZIP behind.
    await runJob(batchId, okRender, (_id, i) => i < 3);
    await writeFile(path.join(batchDir(batchId), "certificate-M5.pdf.tmp"), "partial");
    await writeFile(`${zipFile(batchId)}.tmp`, "partial zip");
    expect((await readdir(batchDir(batchId))).filter((f) => f.endsWith(".pdf"))).toHaveLength(3);

    // Inngest retries: every step runs again (finished ones would be skipped; re-running is the worst case).
    const outcomes = await runJob(batchId);
    const result = await finalizeExport(fx.prisma, batchId, outcomes);
    expect(result).toMatchObject({ status: "ready", included: 6 });
    expect(zipNames(zipFile(batchId))).toEqual(
      ["M1", "M2", "M3", "M4", "M5", "M6"].map((m) => `certificate-${m}.pdf`),
    );
    expect(existsSync(`${zipFile(batchId)}.tmp`)).toBe(false);
  });
});

describe("a failure while building the ZIP", () => {
  it("rejects cleanly (no crash, no half-written ZIP) and succeeds when retried", async () => {
    const { batchId } = await makeBatch(2);
    await requestExport(fx.prisma, batchId);
    const outcomes = await runJob(batchId);
    const victim = path.join(batchDir(batchId), "certificate-M2.pdf");
    const saved = readFileSync(victim);
    await rm(victim);

    await expect(finalizeExport(fx.prisma, batchId, outcomes)).rejects.toThrow();
    expect(existsSync(`${zipFile(batchId)}.tmp`)).toBe(false);
    expect(existsSync(batchDir(batchId))).toBe(true); // PDFs kept, so the retry can rebuild
    expect(
      (await fx.prisma.importBatch.findUniqueOrThrow({ where: { id: batchId } })).zipStatus,
    ).toBe("generating");

    await writeFile(victim, saved);
    expect(await finalizeExport(fx.prisma, batchId, outcomes)).toMatchObject({
      status: "ready",
      included: 2,
    });
    expect(zipNames(zipFile(batchId))).toEqual(["certificate-M1.pdf", "certificate-M2.pdf"]);
  });
});

describe("starting and regenerating", () => {
  it("refuses while a job is queued or generating, and allows it after failed or expired", async () => {
    const { batchId } = await makeBatch(1);
    expect((await requestExport(fx.prisma, batchId)).started).toBe(true);
    expect((await requestExport(fx.prisma, batchId)).started).toBe(false); // queued
    await markGenerating(fx.prisma, batchId);
    expect((await requestExport(fx.prisma, batchId)).started).toBe(false); // generating

    await failExport(fx.prisma, batchId);
    expect((await requestExport(fx.prisma, batchId)).started).toBe(true);
    await fx.prisma.importBatch.update({ where: { id: batchId }, data: { zipStatus: "expired" } });
    expect((await requestExport(fx.prisma, batchId)).started).toBe(true);
  });

  it("wipes the previous run's files and report when it starts again", async () => {
    const { batchId } = await makeBatch(1);
    await mkdir(batchDir(batchId), { recursive: true });
    await writeFile(path.join(batchDir(batchId), "old.pdf"), "old");
    await fx.prisma.importBatch.update({
      where: { id: batchId },
      data: {
        zipStatus: "failed",
        zipReport: [{ certificateId: "x", memberId: "x", reason: "x" }],
      },
    });
    await requestExport(fx.prisma, batchId);
    expect(existsSync(batchDir(batchId))).toBe(false);
    const batch = await fx.prisma.importBatch.findUniqueOrThrow({ where: { id: batchId } });
    expect(batch.zipReport).toBeNull();
  });

  it("refuses a batch with no active certificates", async () => {
    const { batchId, ids } = await makeBatch(1);
    await fx.prisma.certificate.update({
      where: { id: ids[0]! },
      data: { status: "revoked", revokedAt: new Date(), revocationReason: "test" },
    });
    expect((await requestExport(fx.prisma, batchId)).started).toBe(false);
  });
});

describe("cleanupExpired", () => {
  it("deletes an expired ZIP and its folder, keeps the report, and leaves fresh ZIPs alone", async () => {
    const old = await makeBatch(1);
    const fresh = await makeBatch(1);
    for (const { batchId } of [old, fresh]) {
      await requestExport(fx.prisma, batchId);
      await finalizeExport(fx.prisma, batchId, await runJob(batchId));
    }
    await mkdir(batchDir(old.batchId), { recursive: true }); // a leftover folder too
    await fx.prisma.importBatch.update({
      where: { id: old.batchId },
      data: { zipExpiresAt: new Date(Date.now() - 1000) },
    });

    expect(await cleanupExpired(fx.prisma)).toBeGreaterThanOrEqual(1);
    expect(existsSync(zipFile(old.batchId))).toBe(false);
    expect(existsSync(batchDir(old.batchId))).toBe(false);
    expect(existsSync(zipFile(fresh.batchId))).toBe(true);
    const batch = await fx.prisma.importBatch.findUniqueOrThrow({ where: { id: old.batchId } });
    expect(batch).toMatchObject({ zipStatus: "expired", zipPath: null });
    expect(batch.zipReport).toEqual([]);
  });

  it("never follows a path stored in the database", async () => {
    const outside = path.join(root, "..", `outside-${randomBytes(3).toString("hex")}.zip`);
    await writeFile(outside, "must survive");
    const { batchId } = await makeBatch(1);
    await fx.prisma.importBatch.update({
      where: { id: batchId },
      data: { zipStatus: "ready", zipPath: outside, zipExpiresAt: new Date(Date.now() - 1000) },
    });
    await cleanupExpired(fx.prisma);
    expect(existsSync(outside)).toBe(true);
    await rm(outside, { force: true });
  });
});
