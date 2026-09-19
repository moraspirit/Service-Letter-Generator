// Where bulk exports live on disk. Every path is derived from a batch id and EXPORT_DIR; a
// path stored in the database is never followed, so a bad row cannot point a delete elsewhere.
import path from "node:path";

export const ZIP_TTL_MS = 24 * 60 * 60 * 1000;

export function exportRoot(): string {
  return path.resolve(process.cwd(), process.env.EXPORT_DIR?.trim() || "../../.data/tmp-exports");
}

function assertBatchId(batchId: number): void {
  if (!Number.isInteger(batchId) || batchId <= 0) throw new Error("Invalid batch id");
}

/** Folder holding one batch's PDFs while the job runs. */
export function batchDir(batchId: number): string {
  assertBatchId(batchId);
  return path.join(exportRoot(), String(batchId));
}

/** The finished ZIP. */
export function zipFile(batchId: number): string {
  assertBatchId(batchId);
  return path.join(exportRoot(), `${batchId}.zip`);
}
