// The logic of a bulk ZIP export as plain functions (no Inngest in here), so it can be tested
// directly, including a crash halfway and a re-run. The Inngest function in
// inngest/functions.ts only calls these, one step at a time.
//
// Privacy: what these functions return to the job runner (which stores step results) is only
// certificate ids and generic reasons. PDFs and names stay on disk and in MySQL.
import { createWriteStream } from "node:fs";
import { mkdir, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import yazl from "yazl";
import { Prisma, type PrismaClient } from "@moraspirit/db";
import type { CertificateData, FieldSchema } from "@moraspirit/shared";
import { PageOverflowError, renderCertificatePdf, type RenderInput } from "../pdf/render-pdf";
import { batchDir, exportRoot, zipFile, ZIP_TTL_MS } from "./paths";

export interface ReportEntry {
  certificateId: string;
  memberId: string;
  reason: string;
}

export interface RenderOutcome {
  certificateId: string;
  /** Present when the certificate could not be rendered. Generic; never names a person. */
  reason?: string;
}

const SAFE_MEMBER_ID = /^[A-Za-z0-9_-]{1,40}$/;

function memberIdOf(data: unknown): string {
  const value = (data as Record<string, unknown> | null)?.member_id;
  return typeof value === "string" ? value : "";
}

/**
 * The file name for every certificate in a batch: `certificate-<member_id>.pdf` (the member id
 * is the only thing taken from the data, never a recipient's name). A member id that is not
 * filename-safe, or that repeats within the batch, gets the start of the certificate id
 * appended. Deterministic, so a retried job writes the same names.
 */
export function assignFileNames(
  certificates: readonly { id: string; data: unknown }[],
): Map<string, string> {
  const ordered = [...certificates].sort((a, b) => a.id.localeCompare(b.id));
  const counts = new Map<string, number>();
  for (const c of ordered) {
    const member = memberIdOf(c.data);
    if (SAFE_MEMBER_ID.test(member)) counts.set(member, (counts.get(member) ?? 0) + 1);
  }
  const names = new Map<string, string>();
  for (const c of ordered) {
    const member = memberIdOf(c.data);
    const safe = SAFE_MEMBER_ID.test(member);
    const stem =
      safe && counts.get(member) === 1
        ? member
        : [safe ? member : "", c.id.slice(0, 8)].filter(Boolean).join("-");
    names.set(c.id, `certificate-${stem}.pdf`);
  }
  return names;
}

export type StartResult = { started: true } | { started: false; reason: string };

/**
 * Moves a batch to `queued` (only from none / failed / expired, and only for a batch with
 * certificates), clearing the previous run and wiping its files. The caller then sends the event.
 */
export async function requestExport(prisma: PrismaClient, batchId: number): Promise<StartResult> {
  const activeCount = await prisma.certificate.count({
    where: { importBatchId: batchId, status: "active" },
  });
  if (activeCount === 0) {
    return { started: false, reason: "This batch has no active certificates to export." };
  }
  const claimed = await prisma.importBatch.updateMany({
    where: { id: batchId, zipStatus: { in: ["none", "failed", "expired"] } },
    data: {
      zipStatus: "queued",
      zipRenderedCount: 0,
      zipPath: null,
      zipExpiresAt: null,
      zipReport: Prisma.DbNull,
    },
  });
  if (claimed.count === 0) {
    return { started: false, reason: "A ZIP is already being generated for this batch." };
  }
  await removeExportFiles(batchId);
  return { started: true };
}

export async function markGenerating(prisma: PrismaClient, batchId: number): Promise<void> {
  await prisma.importBatch.updateMany({
    where: { id: batchId, zipStatus: { in: ["queued", "generating"] } },
    data: { zipStatus: "generating" },
  });
}

/** The active certificates to render, in a stable order. Returns ids only. */
export async function listExportableIds(prisma: PrismaClient, batchId: number): Promise<string[]> {
  const rows = await prisma.certificate.findMany({
    where: { importBatchId: batchId, status: "active" },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  return rows.map((r) => r.id);
}

export interface RenderOneInput {
  prisma: PrismaClient;
  batchId: number;
  certificateId: string;
  /** Replaceable in tests that do not need a browser. */
  renderPdf?: (input: RenderInput) => Promise<Uint8Array>;
}

/**
 * Renders one certificate into the batch folder. Writes to a temporary name and renames, so a
 * crash never leaves a half-written PDF under a real name; running it twice overwrites the same
 * file, so a retried step neither duplicates nor corrupts anything. Never throws for a
 * per-certificate problem: those come back as a reason.
 */
export async function renderCertificateToFile(input: RenderOneInput): Promise<RenderOutcome> {
  const { prisma, batchId, certificateId } = input;
  const renderPdf = input.renderPdf ?? renderCertificatePdf;

  const certificate = await prisma.certificate.findFirst({
    where: { id: certificateId, importBatchId: batchId, status: "active" },
    include: { templateVersion: true },
  });
  if (!certificate) return { certificateId, reason: "Not found, or no longer active." };

  const siblings = await prisma.certificate.findMany({
    where: { importBatchId: batchId, status: "active" },
    select: { id: true, data: true },
  });
  const fileName = assignFileNames(siblings).get(certificateId);
  if (!fileName) return { certificateId, reason: "Not found, or no longer active." };

  const schema = certificate.templateVersion.fieldSchema as unknown as FieldSchema;
  try {
    const pdf = await renderPdf({
      certificateId,
      templateVersion: {
        htmlContent: certificate.templateVersion.htmlContent,
        fieldSchema: schema,
      },
      data: certificate.data as unknown as CertificateData,
    });
    const dir = batchDir(batchId);
    await mkdir(dir, { recursive: true });
    const finalPath = path.join(dir, fileName);
    const tempPath = `${finalPath}.tmp`;
    await writeFile(tempPath, pdf);
    await rename(tempPath, finalPath);
    return { certificateId };
  } catch (error) {
    if (error instanceof PageOverflowError) {
      const label = schema.find((f) => f.name === error.field)?.label;
      return {
        certificateId,
        reason: label
          ? `Does not fit on one page. Shorten '${label}'.`
          : "Does not fit on one page. Shorten the text.",
      };
    }
    // Only the class is logged: messages can carry recipient details.
    console.error("ZIP export: render failed:", error instanceof Error ? error.name : "unknown");
    return { certificateId, reason: "The PDF could not be rendered." };
  }
}

/** Progress for the UI: how many PDFs are on disk (idempotent, unlike incrementing a counter). */
export async function recordProgress(prisma: PrismaClient, batchId: number): Promise<number> {
  const count = await readdir(batchDir(batchId))
    .then((files) => files.filter((f) => f.endsWith(".pdf")).length)
    .catch(() => 0);
  await prisma.importBatch.updateMany({
    where: { id: batchId, zipStatus: "generating" },
    data: { zipRenderedCount: count },
  });
  return count;
}

async function writeZip(target: string, files: { path: string; name: string }[]): Promise<void> {
  const temp = `${target}.tmp`;
  const zip = new yazl.ZipFile();
  // yazl reports a missing input file as an "error" event; without a listener that would be an
  // uncaught exception instead of a failed (and retryable) step.
  const failed = new Promise<never>((_, reject) => zip.on("error", reject));
  const written = pipeline(zip.outputStream, createWriteStream(temp));
  for (const file of files) zip.addFile(file.path, file.name);
  zip.end();
  try {
    await Promise.race([written, failed]);
    await rename(temp, target);
  } catch (error) {
    await rm(temp, { force: true });
    throw error;
  }
}

export type FinalizeResult =
  { status: "ready"; included: number; reportCount: number } | { status: "failed"; reason: string };

/**
 * Builds the ZIP from the certificates that rendered, stores the report (failures plus
 * certificates left out because they were revoked) and moves the batch to `ready` or `failed`.
 * Safe to run again: the ZIP is written under a temporary name and renamed.
 */
export async function finalizeExport(
  prisma: PrismaClient,
  batchId: number,
  outcomes: readonly RenderOutcome[],
  now: Date = new Date(),
): Promise<FinalizeResult> {
  const all = await prisma.certificate.findMany({
    where: { importBatchId: batchId },
    select: { id: true, status: true, data: true },
  });
  const byId = new Map(all.map((c) => [c.id, c]));
  const names = assignFileNames(all.filter((c) => c.status === "active"));

  const report: ReportEntry[] = [];
  const succeeded: string[] = [];
  for (const outcome of outcomes) {
    if (outcome.reason) {
      report.push({
        certificateId: outcome.certificateId,
        memberId: memberIdOf(byId.get(outcome.certificateId)?.data),
        reason: outcome.reason,
      });
    } else succeeded.push(outcome.certificateId);
  }
  for (const c of all.filter((c) => c.status === "revoked")) {
    report.push({
      certificateId: c.id,
      memberId: memberIdOf(c.data),
      reason: "Revoked, so left out of the ZIP.",
    });
  }

  const dir = batchDir(batchId);
  const files = succeeded.flatMap((id) => {
    const name = names.get(id);
    return name ? [{ path: path.join(dir, name), name }] : [];
  });

  const reportJson = report as unknown as Prisma.InputJsonValue;
  if (files.length === 0) {
    await prisma.importBatch.update({
      where: { id: batchId },
      data: { zipStatus: "failed", zipReport: reportJson, zipRenderedCount: 0 },
    });
    await removeExportFiles(batchId);
    return { status: "failed", reason: "No certificate could be rendered." };
  }

  await mkdir(exportRoot(), { recursive: true });
  await writeZip(zipFile(batchId), files);
  // The batch row is updated BEFORE the PDF folder is removed: if this step is retried after a
  // failure here, the PDFs are still on disk and the ZIP is simply written again.
  await prisma.importBatch.update({
    where: { id: batchId },
    data: {
      zipStatus: "ready",
      zipRenderedCount: files.length,
      zipPath: `${batchId}.zip`,
      zipExpiresAt: new Date(now.getTime() + ZIP_TTL_MS),
      zipReport: reportJson,
    },
  });
  await rm(dir, { recursive: true, force: true });
  return { status: "ready", included: files.length, reportCount: report.length };
}

/** The job itself broke (retries exhausted). */
export async function failExport(prisma: PrismaClient, batchId: number): Promise<void> {
  await prisma.importBatch.updateMany({
    where: { id: batchId, zipStatus: { in: ["queued", "generating"] } },
    data: { zipStatus: "failed" },
  });
  await removeExportFiles(batchId);
}

export async function removeExportFiles(batchId: number): Promise<void> {
  await rm(batchDir(batchId), { recursive: true, force: true });
  await rm(zipFile(batchId), { force: true });
  await rm(`${zipFile(batchId)}.tmp`, { force: true });
}

/** Deletes ZIPs and folders past `zip_expires_at` and marks them `expired`. Returns how many. */
export async function cleanupExpired(
  prisma: PrismaClient,
  now: Date = new Date(),
): Promise<number> {
  const expired = await prisma.importBatch.findMany({
    where: { zipStatus: "ready", zipExpiresAt: { lte: now } },
    select: { id: true },
  });
  for (const { id } of expired) {
    await removeExportFiles(id);
    await prisma.importBatch.update({
      where: { id },
      data: { zipStatus: "expired", zipPath: null },
    });
  }
  return expired.length;
}
