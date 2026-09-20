import Link from "next/link";
import { EmptyState, LinkButton, StatusPill } from "@moraspirit/ui";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { PageHeader } from "../../_components/page-header";

export const dynamic = "force-dynamic";

export default async function ImportsPage() {
  await requireAdmin();
  const batches = await prisma.importBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      adminUser: { select: { email: true } },
      templateVersion: { include: { template: { select: { name: true } } } },
    },
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Bulk imports"
        subtitle="Each batch records the spreadsheet it came from and what happened to every row. Open one to download its certificates as a ZIP."
        actions={
          <LinkButton href="/imports/new" variant="primary" icon="upload">
            New import
          </LinkButton>
        }
      />

      {batches.length === 0 ? (
        <EmptyState
          icon="upload"
          title="No imports yet"
          action={
            <LinkButton href="/imports/new" variant="primary" size="sm" icon="upload">
              Import a spreadsheet
            </LinkButton>
          }
        >
          An import reads an .xlsx or .csv file, checks every row against the template — including
          that each letter still fits on one page — and shows you the result before anything is
          saved.
        </EmptyState>
      ) : (
        <div className="ms-table-wrap">
          <table className="ms-table ms-table-hover">
            <caption className="sr-only">Import batches</caption>
            <thead>
              <tr>
                <th scope="col">Imported</th>
                <th scope="col">File</th>
                <th scope="col">Template</th>
                <th scope="col">Result</th>
                <th scope="col">By</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id}>
                  <td className="ms-tnum">
                    <Link href={`/imports/${b.id}`} className="ms-cell-link">
                      {b.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                    </Link>
                  </td>
                  <td className="ms-cell-name ms-break">{b.fileName}</td>
                  <td>
                    {b.templateVersion.template.name}{" "}
                    <span className="ms-cell-dim">v{b.templateVersion.versionNumber}</span>
                  </td>
                  <td>
                    <span className="ms-counts">
                      <StatusPill tone="ok" icon="check">
                        {b.insertedCount} issued
                      </StatusPill>
                      {b.skippedCount > 0 ? (
                        <StatusPill tone="warn" icon="alert">
                          {b.skippedCount} skipped
                        </StatusPill>
                      ) : null}
                      {b.rejectedCount > 0 ? (
                        <StatusPill tone="bad" icon="revoked">
                          {b.rejectedCount} rejected
                        </StatusPill>
                      ) : null}
                    </span>
                  </td>
                  <td className="ms-cell-dim ms-break">{b.adminUser.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
