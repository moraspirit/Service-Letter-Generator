import Link from "next/link";
import { Card, CardHead, EmptyState, LinkButton, StatusPill } from "@moraspirit/ui";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { PageHeader } from "../../_components/page-header";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    title: "Choose the file",
    body: "An .xlsx workbook or a UTF-8 .csv, up to 5 MB and 500 rows, and the template it should be written with.",
  },
  {
    title: "Review the report",
    body: "Every row is validated and fitted to one page. Duplicates and problems are listed; nothing is saved yet.",
  },
  {
    title: "Import",
    body: "The valid rows become certificates in one step, each with its audit record. Then download them as a ZIP.",
  },
];

export default async function ImportsPage() {
  await requireAdmin();
  const [batches, totals] = await Promise.all([
    prisma.importBatch.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        adminUser: { select: { email: true } },
        templateVersion: { include: { template: { select: { name: true } } } },
      },
    }),
    prisma.importBatch.aggregate({ _count: true, _sum: { insertedCount: true } }),
  ]);

  const last = batches[0]?.createdAt.toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Bulk imports"
        subtitle="Issue a whole pillar from one spreadsheet. Each batch records the file it came from and what happened to every row."
      />

      <section className="ms-import-hero" aria-labelledby="import-how">
        <div className="ms-import-hero-head">
          <div>
            <h2 id="import-how" className="ms-import-hero-title">
              Import a spreadsheet
            </h2>
            <p className="ms-help">
              {totals._count === 0
                ? "No imports yet."
                : `${totals._count} ${totals._count === 1 ? "import" : "imports"} so far, ${totals._sum.insertedCount ?? 0} certificates issued, the last on ${last}.`}
            </p>
          </div>
          <LinkButton href="/imports/new" variant="primary" icon="upload">
            New import
          </LinkButton>
        </div>
        <ol className="ms-import-steps">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <span className="ms-import-step-no" aria-hidden="true">
                {i + 1}
              </span>
              <div>
                <h3 className="ms-import-step-title">{step.title}</h3>
                <p className="ms-help">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {batches.length === 0 ? (
        <EmptyState icon="file" title="Past imports appear here">
          Once you have imported a file, its batch is listed here with the result for every row, and
          a ZIP of the letters you can download for 24 hours.
        </EmptyState>
      ) : (
        <Card>
          <CardHead
            title="Past imports"
            actions={<span className="ms-help">{batches.length} shown, newest first</span>}
          />
          <div className="ms-table-wrap ms-table-flush">
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
        </Card>
      )}

      <p className="ms-help">
        Imports never overwrite: rows that match an existing certificate are skipped unless you
        choose to issue them anyway.
      </p>
    </div>
  );
}
