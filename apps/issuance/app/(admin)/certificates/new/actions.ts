"use server";

import { redirect } from "next/navigation";
import type { RawValues } from "@moraspirit/shared";
import { prisma } from "@/lib/db";
import { issueCertificate } from "@/lib/issue-certificate";
import { requireAdmin } from "@/lib/require-admin";
import type { FormState } from "../_components/form-state";

export async function issueCertificateAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();

  const templateId = Number(formData.get("templateId"));
  if (!Number.isInteger(templateId) || templateId <= 0) {
    return { status: "render_failed", message: "Unknown template." };
  }
  const rawValues: RawValues = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") rawValues[key] = value;
  }

  let result;
  try {
    result = await issueCertificate({
      prisma,
      adminId: admin.id,
      templateId,
      rawValues,
      confirmDuplicate: formData.get("confirmDuplicate") === "1",
    });
  } catch {
    return { status: "render_failed", message: "The certificate could not be issued." };
  }

  if (result.status === "issued") redirect(`/certificates/${result.id}`);
  if (result.status === "duplicate") {
    return {
      status: "duplicate",
      existing: result.existing.map((e) => ({
        id: e.id,
        state: e.status,
        issuedAt: e.issuedAt.toISOString(),
      })),
    };
  }
  return result;
}
