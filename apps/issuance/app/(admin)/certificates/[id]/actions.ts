"use server";

import { redirect } from "next/navigation";
import { restoreCertificate, revokeCertificate } from "@/lib/certificate-changes";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { UUID_PATTERN } from "@/lib/verify-url";

export interface StatusActionState {
  error?: string;
}

async function run(
  change: typeof revokeCertificate,
  formData: FormData,
): Promise<StatusActionState> {
  const admin = await requireAdmin();
  const certificateId = String(formData.get("certificateId") ?? "");
  if (!UUID_PATTERN.test(certificateId)) return { error: "Unknown certificate." };

  let result;
  try {
    result = await change({
      prisma,
      adminId: admin.id,
      certificateId,
      reason: String(formData.get("reason") ?? ""),
    });
  } catch {
    return { error: "The change could not be saved." };
  }

  switch (result.status) {
    case "changed":
      redirect(`/certificates/${certificateId}`);
      break;
    case "invalid":
      return { error: result.errors.reason ?? "Check the reason and try again." };
    case "wrong_state":
      return { error: result.message };
    default:
      return { error: "This certificate no longer exists." };
  }
  return {};
}

export async function revokeAction(
  _previous: StatusActionState,
  formData: FormData,
): Promise<StatusActionState> {
  return run(revokeCertificate, formData);
}

export async function restoreAction(
  _previous: StatusActionState,
  formData: FormData,
): Promise<StatusActionState> {
  return run(restoreCertificate, formData);
}
