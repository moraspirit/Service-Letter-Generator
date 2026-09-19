import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { renderVersionPreview } from "@/lib/template-preview";

export const dynamic = "force-dynamic";

export default async function VersionPreviewPage({
  params,
}: {
  params: Promise<{ id: string; versionId: string }>;
}) {
  await requireAdmin();

  const { id: rawId, versionId: rawVersionId } = await params;
  const id = Number(rawId);
  const versionId = Number(rawVersionId);
  if (![id, versionId].every((n) => Number.isInteger(n) && n > 0)) notFound();

  const version = await prisma.templateVersion.findFirst({
    where: { id: versionId, templateId: id },
    include: { template: { select: { name: true, slug: true } } },
  });
  if (!version) notFound();

  const html = renderVersionPreview(version.template.slug, version);

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/templates/${id}`} className="w-fit text-sm text-red-700 hover:underline">
        ← {version.template.name}
      </Link>
      <h1 className="text-2xl font-semibold">
        {version.template.name} · v{version.versionNumber}
      </h1>
      <p className="text-sm text-zinc-600">
        Preview with fabricated sample data. The QR box is a placeholder until a real certificate is
        rendered.
      </p>
      <div className="overflow-auto rounded border border-zinc-300 bg-zinc-100 p-4">
        {/* sandbox="" = no scripts, no same-origin: template output can never run code here. */}
        <iframe
          title={`${version.template.name} version ${version.versionNumber} preview`}
          sandbox=""
          srcDoc={html}
          className="mx-auto block bg-white shadow"
          style={{ width: "8.5in", height: "11in", border: 0 }}
        />
      </div>
    </div>
  );
}
