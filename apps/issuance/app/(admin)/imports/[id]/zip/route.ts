import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { prisma } from "@/lib/db";
import { zipFile } from "@/lib/export/paths";
import { requireAdminApi } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

/** Streams a finished ZIP to a signed-in admin. The file is never reachable by a public path. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi();
  if (admin instanceof Response) return admin;

  const batchId = Number((await params).id);
  if (!Number.isInteger(batchId) || batchId <= 0) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const batch = await prisma.importBatch.findUnique({
    where: { id: batchId },
    select: { zipStatus: true, zipExpiresAt: true },
  });
  if (
    !batch ||
    batch.zipStatus !== "ready" ||
    !batch.zipExpiresAt ||
    batch.zipExpiresAt.getTime() <= Date.now()
  ) {
    return Response.json({ error: "No ZIP is available for this batch." }, { status: 404 });
  }

  // The path is derived from the batch id, never read from the database.
  const file = zipFile(batchId);
  let size: number;
  try {
    size = (await stat(file)).size;
  } catch {
    return Response.json({ error: "No ZIP is available for this batch." }, { status: 404 });
  }
  return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Length": String(size),
      "Content-Disposition": `attachment; filename="import-${batchId}-certificates.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
