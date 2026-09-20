import Link from "next/link";
import { notFound } from "next/navigation";
import type { FieldSchema } from "@moraspirit/shared";
import { EmptyState, Icon } from "@moraspirit/ui";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { PageHeader } from "../../../_components/page-header";
import { CertificateForm } from "../_components/certificate-form";
import { issueCertificateAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function NewCertificatePage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  await requireAdmin();

  const templateParam = (await searchParams).template;

  // Step one: which letter. Templates are developer-authored, so this is a
  // choice between a handful of published wordings, not a blank canvas.
  if (!templateParam) {
    const templates = await prisma.template.findMany({
      where: { currentVersionId: { not: null } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });

    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Issue a certificate"
          subtitle="Choose the letter to issue. Each template has its own wording and its own set of fields."
        />
        {templates.length === 0 ? (
          <EmptyState icon="file" title="No published templates">
            Templates live in the repository and are published by a developer. Run{" "}
            <code className="ms-code">pnpm templates:publish</code> to publish the ones already
            written.
          </EmptyState>
        ) : (
          <ul className="ms-choices">
            {templates.map((t) => (
              <li key={t.id}>
                <Link href={`/certificates/new?template=${t.id}`} className="ms-choice">
                  <span className="ms-choice-title">{t.name}</span>
                  <Icon name="arrowRight" size={16} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const id = Number(templateParam);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const template = await prisma.template.findUnique({
    where: { id },
    include: { currentVersion: true },
  });
  if (!template?.currentVersion) notFound();

  const fieldSchema = template.currentVersion.fieldSchema as unknown as FieldSchema;
  const defaults = Object.fromEntries(
    fieldSchema.flatMap((f) => (f.default !== undefined ? [[f.name, f.default]] : [])),
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        crumbs={[
          { label: "Issue a certificate", href: "/certificates/new" },
          { label: template.name },
        ]}
        title={template.name}
        subtitle={`Version ${template.currentVersion.versionNumber}. The letter builds beside the form as you type; it must fit on one page to be issued.`}
      />
      <CertificateForm
        mode="issue"
        action={issueCertificateAction}
        hidden={{ templateId: String(template.id) }}
        htmlContent={template.currentVersion.htmlContent}
        fieldSchema={fieldSchema}
        defaults={defaults}
        cancelHref="/certificates"
      />
    </div>
  );
}
