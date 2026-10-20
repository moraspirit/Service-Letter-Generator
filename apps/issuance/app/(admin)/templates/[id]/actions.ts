"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@moraspirit/db";
import {
  LETTER_LAYOUT_DEFAULTS,
  layoutEquals,
  letterLayoutFromRaw,
  type RawValues,
} from "@moraspirit/shared";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";

export type LayoutFormState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "invalid"; errors: Record<string, string> }
  | { status: "missing" };

export async function saveLayoutDefaultsAction(
  _previous: LayoutFormState,
  formData: FormData,
): Promise<LayoutFormState> {
  await requireAdmin();

  const id = Number(formData.get("templateId"));
  if (!Number.isInteger(id) || id <= 0) return { status: "missing" };
  const template = await prisma.template.findUnique({ where: { id }, select: { id: true } });
  if (!template) return { status: "missing" };

  const clear = formData.get("reset") === "1";
  let layoutJson: Prisma.InputJsonValue | typeof Prisma.DbNull = Prisma.DbNull;
  if (!clear) {
    const raw: RawValues = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string") raw[key] = value;
    }
    const parsed = letterLayoutFromRaw(raw);
    if (!parsed.ok || !parsed.layout) {
      return {
        status: "invalid",
        errors: parsed.ok ? { form: "Enter a value for every measurement." } : parsed.errors,
      };
    }
    layoutJson = layoutEquals(parsed.layout, LETTER_LAYOUT_DEFAULTS)
      ? Prisma.DbNull
      : (parsed.layout as unknown as Prisma.InputJsonValue);
  }

  await prisma.template.update({ where: { id }, data: { layoutDefaults: layoutJson } });
  revalidatePath(`/templates/${id}`);
  revalidatePath("/templates");
  revalidatePath("/certificates/new");
  revalidatePath("/");
  return { status: "saved" };
}
