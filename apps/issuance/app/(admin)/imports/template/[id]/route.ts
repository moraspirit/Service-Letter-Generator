import type { FieldSchema } from "@moraspirit/shared";
import { prisma } from "@/lib/db";
import { buildTemplateWorkbook } from "@/lib/import/template-workbook";
import { requireAdminApi } from "@/lib/require-admin";
import { sampleFor } from "@/lib/template-preview";

export const dynamic = "force-dynamic";

/** A blank .xlsx for one template: its exact column headings and one example row. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi();
  if (admin instanceof Response) return admin;

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const template = await prisma.template.findUnique({
    where: { id },
    include: { currentVersion: true },
  });
  if (!template?.currentVersion) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const schema = template.currentVersion.fieldSchema as unknown as FieldSchema;
  const file = buildTemplateWorkbook(schema, sampleFor(template.slug, schema));
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${template.slug}-import-template.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
