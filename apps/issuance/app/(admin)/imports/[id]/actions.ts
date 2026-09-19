"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { failExport, requestExport } from "@/lib/export/zip-export";
import { inngest, ZIP_REQUESTED_EVENT } from "@/lib/inngest/client";
import { requireAdmin } from "@/lib/require-admin";

export type ZipActionState = { status: "idle" } | { status: "error"; message: string };

export async function generateZipAction(
  _previous: ZipActionState,
  formData: FormData,
): Promise<ZipActionState> {
  await requireAdmin();
  const batchId = Number(formData.get("batchId"));
  if (!Number.isInteger(batchId) || batchId <= 0) {
    return { status: "error", message: "Unknown batch." };
  }

  const start = await requestExport(prisma, batchId);
  if (!start.started) return { status: "error", message: start.reason };

  try {
    await inngest.send({ name: ZIP_REQUESTED_EVENT, data: { batchId } });
  } catch {
    await failExport(prisma, batchId);
    return {
      status: "error",
      message:
        "The job could not be started. Is the Inngest server reachable? Nothing was generated.",
    };
  }
  revalidatePath(`/imports/${batchId}`);
  return { status: "idle" };
}
