"use server";

import { redirect } from "next/navigation";
import type { RawValues } from "@moraspirit/shared";
import { editCertificate } from "@/lib/certificate-changes";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { UUID_PATTERN } from "@/lib/verify-url";
import type { FormState } from "../../_components/form-state";

export async function editCertificateAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();

  const certificateId = String(formData.get("certificateId") ?? "");
  if (!UUID_PATTERN.test(certificateId)) {
    return { status: "wrong_state", message: "Unknown certificate." };
  }
  const loadedUpdatedAt = String(formData.get("loadedUpdatedAt") ?? "");
  if (Number.isNaN(new Date(loadedUpdatedAt).getTime())) return { status: "conflict" };

  const rawValues: RawValues = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") rawValues[key] = value;
  }

  let result;
  try {
    result = await editCertificate({
      prisma,
      adminId: admin.id,
      certificateId,
      rawValues,
      reason: String(formData.get("reason") ?? ""),
      loadedUpdatedAt,
      confirmDuplicate: formData.get("confirmDuplicate") === "1",
    });
  } catch {
    return { status: "render_failed", message: "The change could not be saved." };
  }

  if (result.status === "changed") redirect(`/certificates/${certificateId}`);
  if (result.status === "not_found") {
    return { status: "wrong_state", message: "This certificate no longer exists." };
  }
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
