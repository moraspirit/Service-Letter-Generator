// Thin Inngest wrappers around lib/export/zip-export.ts. Everything that matters (naming,
// atomic writes, the report, cleanup) lives in those plain functions and is tested there.
//
// Step results are stored by Inngest, so a step returns only certificate ids and generic
// reasons: never a PDF, a name or any other recipient data. The event carries only the batch id.
import { prisma } from "@/lib/db";
import {
  cleanupExpired,
  failExport,
  finalizeExport,
  listExportableIds,
  markGenerating,
  recordProgress,
  renderCertificateToFile,
  type RenderOutcome,
} from "@/lib/export/zip-export";
import { inngest, ZIP_REQUESTED_EVENT } from "./client";

const RENDER_CONCURRENCY = 2;

function batchIdFrom(data: unknown): number | null {
  const value = (data as { batchId?: unknown } | null)?.batchId;
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

export const generateBatchZip = inngest.createFunction(
  {
    id: "generate-batch-zip",
    triggers: [{ event: ZIP_REQUESTED_EVENT }],
    // One ZIP at a time keeps Chromium's memory bounded on the VPS.
    concurrency: 1,
    retries: 3,
    onFailure: async ({ event }) => {
      // The original event is nested inside the failure event.
      const batchId = batchIdFrom((event.data as { event?: { data?: unknown } }).event?.data);
      if (batchId) await failExport(prisma, batchId);
    },
  },
  async ({ event, step }) => {
    const batchId = batchIdFrom(event.data);
    if (!batchId) return { skipped: "invalid batch id" };

    const ids = await step.run("start", async () => {
      await markGenerating(prisma, batchId);
      return listExportableIds(prisma, batchId);
    });

    const outcomes: RenderOutcome[] = [];
    for (let i = 0; i < ids.length; i += RENDER_CONCURRENCY) {
      const chunk = ids.slice(i, i + RENDER_CONCURRENCY);
      const results = await Promise.all(
        chunk.map((certificateId) =>
          step.run(`render-${certificateId}`, async () => {
            const outcome = await renderCertificateToFile({ prisma, batchId, certificateId });
            await recordProgress(prisma, batchId);
            return outcome;
          }),
        ),
      );
      outcomes.push(...results);
    }

    return step.run("build-zip", () => finalizeExport(prisma, batchId, outcomes));
  },
);

/** Deletes ZIPs 24 hours after they were generated. */
export const cleanupExpiredZips = inngest.createFunction(
  { id: "cleanup-expired-zips", triggers: [{ cron: "0 * * * *" }] },
  async ({ step }) => ({ removed: await step.run("cleanup", () => cleanupExpired(prisma)) }),
);

export const functions = [generateBatchZip, cleanupExpiredZips];
