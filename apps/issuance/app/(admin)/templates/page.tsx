import Link from "next/link";
import { Banner, EmptyState, StatusPill } from "@moraspirit/ui";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { PageHeader } from "../../_components/page-header";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  await requireAdmin();

  const templates = await prisma.template.findMany({
    orderBy: { name: "asc" },
    include: {
      currentVersion: { select: { versionNumber: true } },
      _count: { select: { versions: true } },
    },
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Templates"
        subtitle="The letters this system can issue, and every published version of each."
      />

      <Banner tone="info" title="This screen is read-only">
        Templates are written in the repository by a developer and published with{" "}
        <code className="ms-code">pnpm templates:publish</code>. There is no editor here on purpose:
        a template is reviewed code, and every issued certificate is pinned to the exact version it
        was created with.
      </Banner>

      {templates.length === 0 ? (
        <EmptyState icon="file" title="No templates published yet">
          Run <code className="ms-code">pnpm templates:publish</code> to publish the templates
          already written in the repository.
        </EmptyState>
      ) : (
        <div className="ms-table-wrap">
          <table className="ms-table ms-table-hover">
            <caption className="sr-only">Published templates</caption>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Slug</th>
                <th scope="col">Current version</th>
                <th scope="col">Versions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link href={`/templates/${t.id}`} className="ms-cell-link">
                      {t.name}
                    </Link>
                  </td>
                  <td className="ms-mono ms-cell-dim">{t.slug}</td>
                  <td>
                    {t.currentVersion ? (
                      <StatusPill tone="ok" icon="check">
                        v{t.currentVersion.versionNumber}
                      </StatusPill>
                    ) : (
                      <StatusPill tone="warn" icon="alert">
                        Not published
                      </StatusPill>
                    )}
                  </td>
                  <td className="ms-tnum ms-cell-dim">{t._count.versions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
