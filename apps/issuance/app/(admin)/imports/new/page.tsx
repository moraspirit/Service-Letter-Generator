import { EmptyState } from "@moraspirit/ui";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { PageHeader } from "../../../_components/page-header";
import { ImportForm } from "./import-form";

export const dynamic = "force-dynamic";

export default async function NewImportPage() {
  await requireAdmin();
  const templates = await prisma.template.findMany({
    where: { currentVersionId: { not: null } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        crumbs={[{ label: "Bulk imports", href: "/imports" }, { label: "New import" }]}
        title="Import certificates"
        subtitle="Pick a template and a spreadsheet whose column headings match its fields — for the service letters: Member ID, Name, Gender, Pillar, Start date, End date, General Points, Special Points. Every row is checked before anything is saved."
      />
      {templates.length === 0 ? (
        <EmptyState icon="file" title="No published templates">
          Templates live in the repository and are published by a developer. Run{" "}
          <code className="ms-code">pnpm templates:publish</code> before importing.
        </EmptyState>
      ) : (
        <ImportForm templates={templates} />
      )}
    </div>
  );
}
