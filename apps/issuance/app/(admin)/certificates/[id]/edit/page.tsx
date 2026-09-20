import { notFound } from "next/navigation";
import { richTextToPlainText, type CertificateData, type FieldSchema } from "@moraspirit/shared";
import { Banner, LinkButton } from "@moraspirit/ui";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { UUID_PATTERN } from "@/lib/verify-url";
import { PageHeader } from "../../../../_components/page-header";
import { CertificateForm } from "../../_components/certificate-form";
import { editCertificateAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function EditCertificatePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();

  const certificate = await prisma.certificate.findUnique({
    where: { id },
    include: { templateVersion: { include: { template: { select: { name: true } } } } },
  });
  if (!certificate) notFound();

  const data = certificate.data as unknown as CertificateData;
  const name = typeof data.recipient_name === "string" ? data.recipient_name : "Certificate";
  const crumbs = [
    { label: "Certificates", href: "/certificates" },
    { label: name, href: `/certificates/${id}` },
    { label: "Edit" },
  ];

  if (certificate.status === "revoked") {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader crumbs={crumbs} title="Edit certificate" />
        <Banner tone="warn" title="This certificate is revoked">
          <p>
            A revoked certificate cannot be edited, so the record matches what the public
            verification page shows. Restore it first, then make the change.
          </p>
          <div className="pt-2">
            <LinkButton href={`/certificates/${id}`} variant="secondary" size="sm">
              Back to the certificate
            </LinkButton>
          </div>
        </Banner>
      </div>
    );
  }

  // The pinned version's schema and template: an edit never moves a certificate to a newer version.
  const version = certificate.templateVersion;
  const fieldSchema = version.fieldSchema as unknown as FieldSchema;
  const defaults = Object.fromEntries(
    fieldSchema.map((field) => {
      const value = data[field.name];
      if (Array.isArray(value)) return [field.name, value.join("\n")];
      if (typeof value !== "string") return [field.name, ""];
      return [field.name, field.type === "richtext" ? richTextToPlainText(value) : value];
    }),
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        crumbs={crumbs}
        title="Edit certificate"
        subtitle={`${version.template.name} · v${version.versionNumber}. Editing keeps the template version this certificate was issued with, so its wording and layout do not shift.`}
      />
      <CertificateForm
        mode="edit"
        action={editCertificateAction}
        hidden={{
          certificateId: certificate.id,
          loadedUpdatedAt: certificate.updatedAt.toISOString(),
        }}
        htmlContent={version.htmlContent}
        fieldSchema={fieldSchema}
        defaults={defaults}
        cancelHref={`/certificates/${id}`}
      />
    </div>
  );
}
