import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";

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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Bulk imports</h1>
        <Link href="/imports/new" className="text-red-700 hover:underline">
          New import →
        </Link>
      </div>
      {batches.length === 0 ? (
        <p className="text-zinc-600">No imports yet.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-300 text-zinc-600">
            <tr>
              <th className="py-2 pr-4">Imported</th>
              <th className="py-2 pr-4">File</th>
              <th className="py-2 pr-4">Template</th>
              <th className="py-2 pr-4">Issued</th>
              <th className="py-2 pr-4">Skipped</th>
              <th className="py-2 pr-4">Rejected</th>
              <th className="py-2">By</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id} className="border-b border-zinc-200">
                <td className="py-2 pr-4">
                  <Link href={`/imports/${b.id}`} className="text-red-700 hover:underline">
                    {b.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                  </Link>
                </td>
                <td className="py-2 pr-4">{b.fileName}</td>
                <td className="py-2 pr-4">
                  {b.templateVersion.template.name} · v{b.templateVersion.versionNumber}
                </td>
                <td className="py-2 pr-4">{b.insertedCount}</td>
                <td className="py-2 pr-4">{b.skippedCount}</td>
                <td className="py-2 pr-4">{b.rejectedCount}</td>
                <td className="py-2">{b.adminUser.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
