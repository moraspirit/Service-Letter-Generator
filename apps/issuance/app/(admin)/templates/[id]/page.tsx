import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";

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
    <div className="flex flex-col gap-4">
      <Link href="/templates" className="w-fit text-sm text-red-700 hover:underline">
        ← All templates
      </Link>
      <h1 className="text-2xl font-semibold">{template.name}</h1>
      <p className="font-mono text-xs text-zinc-600">{template.slug}</p>

      <h2 className="mt-4 text-lg font-semibold">Version history</h2>
      <p className="text-sm text-zinc-600">
        Versions are immutable. Certificates stay on the version they were issued with.
      </p>
      <table className="w-full text-left text-sm">
        <thead className="border-b border-zinc-300 text-zinc-600">
          <tr>
            <th className="py-2 pr-4">Version</th>
            <th className="py-2 pr-4">Published</th>
            <th className="py-2 pr-4">Content hash</th>
            <th className="py-2 pr-4">Certificates</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {template.versions.map((v) => (
            <tr key={v.id} className="border-b border-zinc-200">
              <td className="py-2 pr-4">
                v{v.versionNumber}
                {v.id === template.currentVersionId ? (
                  <span className="ml-2 rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">
                    current
                  </span>
                ) : null}
              </td>
              <td className="py-2 pr-4">
                {v.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC
              </td>
              <td className="py-2 pr-4 font-mono text-xs">{v.contentHash.slice(0, 12)}…</td>
              <td className="py-2 pr-4">{v._count.certificates}</td>
              <td className="py-2">
                <Link
                  href={`/templates/${template.id}/versions/${v.id}`}
                  className="text-red-700 hover:underline"
                >
                  Preview
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
