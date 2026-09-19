import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";

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
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Templates</h1>
      <p className="text-sm text-zinc-600">
        Templates are authored in the repository and published with{" "}
        <code className="rounded bg-zinc-100 px-1">pnpm templates:publish</code>. This screen is
        read-only.
      </p>
      {templates.length === 0 ? (
        <p className="text-zinc-600">No templates published yet.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-300 text-zinc-600">
            <tr>
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Slug</th>
              <th className="py-2 pr-4">Current version</th>
              <th className="py-2">Versions</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id} className="border-b border-zinc-200">
                <td className="py-2 pr-4">
                  <Link href={`/templates/${t.id}`} className="text-red-700 hover:underline">
                    {t.name}
                  </Link>
                </td>
                <td className="py-2 pr-4 font-mono text-xs">{t.slug}</td>
                <td className="py-2 pr-4">
                  {t.currentVersion ? `v${t.currentVersion.versionNumber}` : "none"}
                </td>
                <td className="py-2">{t._count.versions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
