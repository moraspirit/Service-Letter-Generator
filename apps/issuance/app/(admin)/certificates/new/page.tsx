import Link from "next/link";
import { notFound } from "next/navigation";
import type { FieldSchema } from "@moraspirit/shared";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { CertificateForm } from "./certificate-form";

export const dynamic = "force-dynamic";

export default async function NewCertificatePage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  await requireAdmin();

  const templateParam = (await searchParams).template;

  if (!templateParam) {
    const templates = await prisma.template.findMany({
      where: { currentVersionId: { not: null } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Issue a certificate</h1>
        <p className="text-zinc-600">Choose a template.</p>
        {templates.length === 0 ? (
          <p className="text-zinc-600">
            No published templates. Run{" "}
            <code className="rounded bg-zinc-100 px-1">pnpm templates:publish</code>.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {templates.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/certificates/new?template=${t.id}`}
                  className="text-red-700 hover:underline"
                >
                  {t.name}
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
    <div className="flex flex-col gap-4">
      <Link href="/certificates/new" className="w-fit text-sm text-red-700 hover:underline">
        ← Choose another template
      </Link>
      <h1 className="text-2xl font-semibold">{template.name}</h1>
      <CertificateForm
        templateId={template.id}
        htmlContent={template.currentVersion.htmlContent}
        fieldSchema={fieldSchema}
        defaults={defaults}
      />
    </div>
  );
}
