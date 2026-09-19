import Link from "next/link";
import type { ComponentProps } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { ZipPanel } from "./zip-panel";

export const dynamic = "force-dynamic";

export default async function ImportBatchPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();

  const id = Number((await params).id);
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

  const facts: [string, string][] = [
    ["File", batch.fileName + (batch.sheetName ? ` (sheet "${batch.sheetName}")` : "")],
    [
      "Template",
      `${batch.templateVersion.template.name} · v${batch.templateVersion.versionNumber}`,
    ],
    ["Imported", batch.createdAt.toISOString().slice(0, 16).replace("T", " ") + " UTC"],
    ["By", batch.adminUser.email],
    ["Rows in file", String(batch.rowCount)],
    ["Issued", String(batch.insertedCount)],
    ["Skipped as duplicates", String(batch.skippedCount)],
    ["Rejected as invalid", String(batch.rejectedCount)],
  ];

  return (
    <div className="flex flex-col gap-4">
      <Link href="/imports" className="w-fit text-sm text-red-700 hover:underline">
        ← All imports
      </Link>
      <h1 className="text-2xl font-semibold">Import #{batch.id}</h1>
      <dl className="grid max-w-xl grid-cols-[12rem_1fr] gap-y-1 text-sm">
        {facts.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-zinc-600">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <ZipPanel
        batchId={batch.id}
        status={batch.zipStatus}
        rendered={batch.zipRenderedCount}
        total={batch.certificates.filter((c) => c.status === "active").length}
        expiresAt={batch.zipExpiresAt?.toISOString() ?? null}
        report={
          Array.isArray(batch.zipReport)
            ? (batch.zipReport as unknown as ComponentProps<typeof ZipPanel>["report"])
            : []
        }
      />

      <h2 className="mt-2 text-lg font-semibold">Certificates in this batch</h2>
      <table className="w-full text-left text-sm">
        <thead className="border-b border-zinc-300 text-zinc-600">
          <tr>
            <th className="py-2 pr-4">Member ID</th>
            <th className="py-2 pr-4">Name</th>
            <th className="py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {batch.certificates.map((c) => {
            const data = c.data as Record<string, unknown>;
            return (
              <tr key={c.id} className="border-b border-zinc-200">
                <td className="py-2 pr-4 font-mono text-xs">
                  <Link href={`/certificates/${c.id}`} className="text-red-700 hover:underline">
                    {String(data.member_id ?? c.id.slice(0, 8))}
                  </Link>
                </td>
                <td className="py-2 pr-4">{String(data.recipient_name ?? "")}</td>
                <td className="py-2">{c.status}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
