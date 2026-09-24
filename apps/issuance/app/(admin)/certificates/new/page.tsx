import Link from "next/link";
import { notFound } from "next/navigation";
import type { FieldSchema } from "@moraspirit/shared";
import { EmptyState, Icon, LinkButton } from "@moraspirit/ui";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { renderVersionPreview } from "@/lib/template-preview";
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
    const rows = await prisma.template.findMany({
      where: { currentVersionId: { not: null } },
      orderBy: { name: "asc" },
      include: { currentVersion: true },
    });
    const templates = await Promise.all(
      rows.flatMap((t) => {
        const version = t.currentVersion;
        if (!version) return [];
        const fields = version.fieldSchema as unknown as FieldSchema;
        return [
          prisma.certificate
            .count({ where: { templateVersion: { templateId: t.id } } })
            .then((issued) => ({
              id: t.id,
              name: t.name,
              versionNumber: version.versionNumber,
              issued,
              fieldCount: fields.length,
              requiredCount: fields.filter((f) => f.required && f.default === undefined).length,
              sections: fields
                .filter((f) => f.type === "list" || f.type === "richtext")
                .map((f) => (f.required ? f.label : `${f.label} (optional)`)),
              preview: renderVersionPreview(t.slug, version),
            })),
        ];
      }),
    );

    return (
      <div className="flex flex-col gap-6">
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
                  <div className="ms-choice-thumb" aria-hidden="true">
                    {/* sandbox="" = no scripts, no same-origin, as in the template preview. */}
                    <iframe
                      title={`${t.name} preview`}
                      sandbox=""
                      srcDoc={t.preview}
                      width={816}
                      height={1056}
                      tabIndex={-1}
                    />
                  </div>
                  <div className="ms-choice-body">
                    <h2 className="ms-choice-title">{t.name}</h2>
                    <dl className="ms-choice-facts">
                      <div>
                        <dt>Version</dt>
                        <dd className="ms-tnum">v{t.versionNumber}</dd>
                      </div>
                      <div>
                        <dt>Fields</dt>
                        <dd className="ms-tnum">
                          {t.fieldCount} ({t.requiredCount} to fill in)
                        </dd>
                      </div>
                      <div>
                        <dt>Issued so far</dt>
                        <dd className="ms-tnum">{t.issued}</dd>
                      </div>
                      {t.sections.length > 0 ? (
                        <div>
                          <dt>Written sections</dt>
                          <dd>{t.sections.join(", ")}</dd>
                        </div>
                      ) : null}
                    </dl>
                    <span className="ms-btn ms-btn-primary ms-choice-cta">
                      Issue this letter
                      <Icon name="arrowRight" size={16} />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <aside className="ms-note-strip">
          <div>
            <h2 className="ms-section-title">Issuing a whole pillar at once?</h2>
            <p className="ms-help">
              Upload a spreadsheet instead. Every row is checked and fitted to one page before
              anything is issued.
            </p>
          </div>
          <LinkButton href="/imports/new" variant="secondary" icon="upload">
            Bulk import
          </LinkButton>
        </aside>
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
