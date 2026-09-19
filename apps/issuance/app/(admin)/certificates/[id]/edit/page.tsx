import Link from "next/link";
import { notFound } from "next/navigation";
import { richTextToPlainText, type CertificateData, type FieldSchema } from "@moraspirit/shared";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { UUID_PATTERN } from "@/lib/verify-url";
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

  const back = (
    <Link href={`/certificates/${id}`} className="w-fit text-sm text-red-700 hover:underline">
      ← Back to the certificate
    </Link>
  );

  if (certificate.status === "revoked") {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <h1 className="text-2xl font-semibold">Edit certificate</h1>
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          This certificate is revoked. Restore it before editing.
        </p>
      </div>
    );
  }

  // The pinned version's schema and template: an edit never moves a certificate to a newer version.
  const version = certificate.templateVersion;
  const fieldSchema = version.fieldSchema as unknown as FieldSchema;
  const data = certificate.data as unknown as CertificateData;
  const defaults = Object.fromEntries(
    fieldSchema.map((field) => {
      const value = data[field.name];
      if (Array.isArray(value)) return [field.name, value.join("\n")];
      if (typeof value !== "string") return [field.name, ""];
      return [field.name, field.type === "richtext" ? richTextToPlainText(value) : value];
    }),
  );

  return (
    <div className="flex flex-col gap-4">
      {back}
      <h1 className="text-2xl font-semibold">Edit certificate</h1>
      <p className="text-sm text-zinc-600">
        {version.template.name} · v{version.versionNumber}. Editing keeps the template version this
        certificate was issued with.
      </p>
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
      />
    </div>
  );
}
