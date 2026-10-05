import { buildImportGuide, type FieldSchema } from "@moraspirit/shared";
import { EmptyState } from "@moraspirit/ui";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { PageHeader } from "../../../_components/page-header";
import { ImportForm } from "./import-form";

export const dynamic = "force-dynamic";

export default async function NewImportPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  await requireAdmin();
  const requested = Number((await searchParams).template);
  const rows = await prisma.template.findMany({
    where: { currentVersionId: { not: null } },
    orderBy: { name: "asc" },
    include: { currentVersion: { select: { fieldSchema: true } } },
  });
  const templates = rows.map((t) => ({
    id: t.id,
    name: t.name,
    guide: buildImportGuide((t.currentVersion?.fieldSchema ?? []) as unknown as FieldSchema),
  }));

  const initialTemplateId = templates.some((t) => t.id === requested) ? requested : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        crumbs={[{ label: "Bulk imports", href: "/imports" }, { label: "New import" }]}
        title="Import certificates"
        subtitle="Pick a template to see the columns its spreadsheet needs, then choose the file. Every row is checked before anything is saved."
      />
      {templates.length === 0 ? (
        <EmptyState icon="file" title="No published templates">
          Templates live in the repository and are published by a developer. Run{" "}
          <code className="ms-code">pnpm templates:publish</code> before importing.
        </EmptyState>
      ) : (
        <ImportForm templates={templates} initialTemplateId={initialTemplateId} />
      )}
    </div>
  );
}
