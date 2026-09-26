import Link from "next/link";
import type { ComponentProps } from "react";
import { notFound } from "next/navigation";
import {
  Card,
  CardBody,
  CardHead,
  CertificateStatusPill,
  DescriptionList,
  EmptyState,
  StatusPill,
} from "@moraspirit/ui";
import { prisma } from "@/lib/db";
import { isQueueKey } from "@/lib/fix-queue";
import { requireAdmin } from "@/lib/require-admin";
import { PageHeader } from "../../../_components/page-header";
import { BatchRejectedRows } from "./batch-rejected-rows";
import { ZipPanel } from "./zip-panel";

export const dynamic = "force-dynamic";

export default async function ImportBatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fix?: string }>;
}) {
  await requireAdmin();

  const id = Number((await params).id);
  const { fix } = await searchParams;
  if (!Number.isInteger(id) || id <= 0) notFound();
  const batch = await prisma.importBatch.findUnique({
    where: { id },
    include: {
      adminUser: { select: { email: true } },
      templateVersion: { include: { template: { select: { name: true } } } },
      certificates: {
        orderBy: { createdAt: "asc" },
        select: { id: true, status: true, data: true },
      },
    },
  });
  if (!batch) notFound();

  const activeCount = batch.certificates.filter((c) => c.status === "active").length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        crumbs={[{ label: "Bulk imports", href: "/imports" }, { label: `Import #${batch.id}` }]}
        title={`Import #${batch.id}`}
        subtitle={batch.fileName + (batch.sheetName ? ` · sheet “${batch.sheetName}”` : "")}
        actions={
          <span className="ms-counts">
            <StatusPill tone="ok" icon="check">
              {batch.insertedCount} issued
            </StatusPill>
            {batch.skippedCount > 0 ? (
              <StatusPill tone="warn" icon="alert">
                {batch.skippedCount} skipped
              </StatusPill>
            ) : null}
            {batch.rejectedCount > 0 ? (
              <StatusPill tone="bad" icon="revoked">
                {batch.rejectedCount} rejected
              </StatusPill>
            ) : null}
          </span>
        }
      />

      <div className="ms-detail">
        <div className="flex flex-col gap-5">
          <ZipPanel
            batchId={batch.id}
            status={batch.zipStatus}
            rendered={batch.zipRenderedCount}
            total={activeCount}
            expiresAt={batch.zipExpiresAt?.toISOString() ?? null}
            report={
              Array.isArray(batch.zipReport)
                ? (batch.zipReport as unknown as ComponentProps<typeof ZipPanel>["report"])
                : []
            }
          />

          <Card>
            <CardHead
              title="Certificates in this batch"
              actions={<span className="ms-help">{batch.certificates.length}</span>}
            />
            {batch.certificates.length === 0 ? (
              <CardBody>
                <EmptyState icon="file" title="No certificates were created">
                  Every row was either rejected as invalid or skipped as a duplicate.
                </EmptyState>
              </CardBody>
            ) : (
              <table className="ms-table ms-table-hover">
                <caption className="sr-only">Certificates created by this import</caption>
                <thead>
                  <tr>
                    <th scope="col">Member ID</th>
                    <th scope="col">Recipient</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {batch.certificates.map((c) => {
                    const data = c.data as Record<string, unknown>;
                    return (
                      <tr key={c.id}>
                        <td>
                          <Link href={`/certificates/${c.id}`} className="ms-mono ms-cell-link">
                            {String(data.member_id ?? c.id.slice(0, 8))}
                          </Link>
                        </td>
                        <td className="ms-cell-name">{String(data.recipient_name ?? "—")}</td>
                        <td>
                          <CertificateStatusPill status={c.status as "active" | "revoked"} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>

          {batch.rejectedCount > 0 ? (
            <BatchRejectedRows
              queueKey={isQueueKey(fix) ? fix : null}
              rejectedCount={batch.rejectedCount}
            />
          ) : null}
        </div>

        <aside>
          <Card>
            <CardHead title="Batch record" />
            <CardBody>
              <DescriptionList
                className="ms-dl-stack"
                items={[
                  { label: "File", value: <span className="ms-break">{batch.fileName}</span> },
                  ...(batch.sheetName ? [{ label: "Worksheet", value: batch.sheetName }] : []),
                  {
                    label: "Template",
                    value: `${batch.templateVersion.template.name} · v${batch.templateVersion.versionNumber}`,
                  },
                  {
                    label: "Imported",
                    value: `${batch.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC`,
                  },
                  { label: "By", value: <span className="ms-break">{batch.adminUser.email}</span> },
                  { label: "Rows in file", value: String(batch.rowCount) },
                  { label: "Issued", value: String(batch.insertedCount) },
                  { label: "Skipped as duplicates", value: String(batch.skippedCount) },
                  { label: "Rejected as invalid", value: String(batch.rejectedCount) },
                ]}
              />
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}
