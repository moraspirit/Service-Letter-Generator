import { Banner, EmptyState } from "@moraspirit/ui";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { templateFacts } from "@/lib/template-facts";
import { renderVersionPreview } from "@/lib/template-preview";
import { PageHeader } from "../../_components/page-header";
import { TemplateCard } from "../../_components/template-card";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  await requireAdmin();

  const rows = await prisma.template.findMany({
    orderBy: { name: "asc" },
    include: {
      currentVersion: true,
      _count: { select: { versions: true } },
    },
  });
  const templates = await Promise.all(
    rows.map(async (t) => {
      const version = t.currentVersion;
      const issued = await prisma.certificate.count({
        where: { templateVersion: { templateId: t.id } },
      });
      return {
        id: t.id,
        name: t.name,
        preview: version ? renderVersionPreview(t.slug, version) : null,
        facts: [
          ...(version
            ? templateFacts(version, issued)
            : [{ label: "Current version", value: "Not published" }]),
          { label: "Versions published", value: String(t._count.versions) },
          { label: "Folder", value: t.slug },
        ],
      };
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Templates"
        subtitle="The letters this system can issue, and every published version of each."
      />

      {templates.length === 0 ? (
        <EmptyState icon="file" title="No templates published yet">
          Run <code className="ms-code">pnpm templates:publish</code> to publish the templates
          already written in the repository.
        </EmptyState>
      ) : (
        <ul className="ms-choices">
          {templates.map((t) => (
            <li key={t.id}>
              <TemplateCard
                href={`/templates/${t.id}`}
                name={t.name}
                preview={t.preview}
                facts={t.facts}
                cta="View versions"
                ctaVariant="secondary"
              />
            </li>
          ))}
        </ul>
      )}

      <Banner tone="info" title="This screen is read-only">
        Templates are written in the repository by a developer and published with{" "}
        <code className="ms-code">pnpm templates:publish</code>. There is no editor here on purpose:
        a template is reviewed code, and every issued certificate is pinned to the exact version it
        was created with.
      </Banner>
    </div>
  );
}
