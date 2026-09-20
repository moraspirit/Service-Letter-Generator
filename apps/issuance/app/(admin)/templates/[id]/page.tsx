import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardHead, StatusPill } from "@moraspirit/ui";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { PageHeader } from "../../../_components/page-header";

export const dynamic = "force-dynamic";

export default async function TemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const template = await prisma.template.findUnique({
    where: { id },
    include: {
      versions: {
        orderBy: { versionNumber: "desc" },
        select: {
          id: true,
          versionNumber: true,
          contentHash: true,
          createdAt: true,
          _count: { select: { certificates: true } },
        },
      },
    },
  });
  if (!template) notFound();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        crumbs={[{ label: "Templates", href: "/templates" }, { label: template.name }]}
        title={template.name}
        subtitle={
          <>
            <span className="ms-mono">{template.slug}</span> — versions are immutable, and each
            certificate stays on the one it was issued with, so republishing never changes a letter
            already in someone&apos;s hands.
          </>
        }
      />

      <Card>
        <CardHead
          title="Version history"
          actions={<span className="ms-help">{template.versions.length} published</span>}
        />
        <table className="ms-table ms-table-hover">
          <caption className="sr-only">Published versions of {template.name}</caption>
          <thead>
            <tr>
              <th scope="col">Version</th>
              <th scope="col">Published</th>
              <th scope="col">Content hash</th>
              <th scope="col">Certificates</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {template.versions.map((v) => (
              <tr key={v.id}>
                <td>
                  <span className="ms-version">
                    v{v.versionNumber}
                    {v.id === template.currentVersionId ? (
                      <StatusPill tone="ok" icon="check">
                        Current
                      </StatusPill>
                    ) : null}
                  </span>
                </td>
                <td className="ms-tnum ms-cell-dim">
                  {v.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC
                </td>
                <td className="ms-mono ms-cell-dim">{v.contentHash.slice(0, 12)}…</td>
                <td className="ms-tnum">{v._count.certificates}</td>
                <td>
                  <Link
                    href={`/templates/${template.id}/versions/${v.id}`}
                    className="ms-btn ms-btn-secondary ms-btn-sm"
                  >
                    Preview
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
