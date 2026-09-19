"use server";

import { redirect } from "next/navigation";
import { analyzeImport, type AnalysisResult } from "@/lib/import/analyze-import";
import { commitImport } from "@/lib/import/commit-import";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";

export type ImportState =
  | { status: "idle" }
  | { status: "analysis"; result: AnalysisResult }
  | { status: "blocked"; message: string }
  | { status: "failed"; message: string };

/** One action for both buttons: `intent=check` validates, `intent=import` commits. */
export async function importAction(
  _previous: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const admin = await requireAdmin();

  const templateId = Number(formData.get("templateId"));
  const file = formData.get("file");
  if (!Number.isInteger(templateId) || templateId <= 0) {
    return { status: "failed", message: "Choose a template." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { status: "failed", message: "Choose a .xlsx or .csv file." };
  }
  const sheetName = String(formData.get("sheetName") ?? "").trim() || undefined;
  const common = {
    prisma,
    templateId,
    fileName: file.name,
    buffer: Buffer.from(await file.arrayBuffer()),
    sheetName,
  };

  try {
    if (formData.get("intent") !== "import") {
      return { status: "analysis", result: await analyzeImport(common) };
    }
    const result = await commitImport({
      ...common,
      adminId: admin.id,
      issueAnywayRows: formData
        .getAll("issueAnyway")
        .map(Number)
        .filter((n) => Number.isInteger(n)),
      skipInvalid: formData.get("skipInvalid") === "1",
      confirmDuplicateFile: formData.get("confirmDuplicateFile") === "1",
    });
    if (result.status === "committed") redirect(`/imports/${result.batchId}`);
    if (result.status === "blocked") return { status: "blocked", message: result.reason };
    return { status: "failed", message: result.message };
  } catch (error) {
    // redirect() works by throwing; let it through.
    if (error instanceof Error && "digest" in error) throw error;
    return {
      status: "failed",
      message: "The import could not be completed. Nothing was imported.",
    };
  }
}
