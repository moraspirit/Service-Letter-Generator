import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { renderVersionPreview } from "@/lib/template-preview";
import { PageHeader } from "../../../../../_components/page-header";

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
    <div className="flex flex-col gap-5">
      <PageHeader
        crumbs={[
          { label: "Templates", href: "/templates" },
          { label: version.template.name, href: `/templates/${id}` },
          { label: `v${version.versionNumber}` },
        ]}
        title={`${version.template.name} · v${version.versionNumber}`}
        subtitle="Rendered with fabricated sample data. The QR box is a placeholder until a real certificate is issued."
      />

      <div className="ms-letter-wrap ms-letter-center">
        {/* sandbox="" = no scripts, no same-origin: template output can never run code here. */}
        <iframe
          className="ms-letter"
          title={`${version.template.name} version ${version.versionNumber} preview`}
          sandbox=""
          srcDoc={html}
          width={816}
          height={1056}
        />
      </div>
    </div>
  );
}
