import Link from "next/link";
import { notFound } from "next/navigation";
import type { CertificateData, FieldSchema } from "@moraspirit/shared";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { sanitizeRichText } from "@/lib/sanitize";
import { buildVerifyUrl, UUID_PATTERN, VerifyUrlError } from "@/lib/verify-url";

export const dynamic = "force-dynamic";

export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();

  const certificate = await prisma.certificate.findUnique({
    where: { id },
    include: {
      templateVersion: { include: { template: { select: { name: true } } } },
      auditEntries: {
        orderBy: { createdAt: "asc" },
        include: { adminUser: { select: { email: true } } },
      },
    },
  });
  if (!certificate) notFound();

  const schema = certificate.templateVersion.fieldSchema as unknown as FieldSchema;
  const data = certificate.data as unknown as CertificateData;

  let verifyUrl: string | null = null;
  let verifyProblem: string | null = null;
  try {
    verifyUrl = buildVerifyUrl(certificate.id);
  } catch (error) {
    verifyProblem =
      error instanceof VerifyUrlError ? error.message : "Verification URL unavailable";
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/certificates/new" className="text-sm text-red-700 hover:underline">
          ← Issue another
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Certificate</h1>
        <p className="font-mono text-xs text-zinc-600">{certificate.id}</p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <a
          href={`/certificates/${certificate.id}/pdf`}
          className="rounded bg-red-700 px-4 py-2 font-medium text-white"
        >
          Download PDF
        </a>
        <span
          className={`rounded px-2 py-0.5 text-xs ${
            certificate.status === "active"
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {certificate.status}
        </span>
      </div>

      <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-zinc-600">Template</dt>
        <dd>
          {certificate.templateVersion.template.name} · v{certificate.templateVersion.versionNumber}
        </dd>
        <dt className="text-zinc-600">Issued</dt>
        <dd>{certificate.issuedAt.toISOString().slice(0, 16).replace("T", " ")} UTC</dd>
        <dt className="text-zinc-600">Verification URL</dt>
        <dd className="break-all">
          {verifyUrl ? (
            <span className="font-mono text-xs">{verifyUrl}</span>
          ) : (
            <span className="text-red-700">{verifyProblem}</span>
          )}
        </dd>
        {schema.map((field) => {
          const value = data[field.name];
          if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
            return null;
          }
          return (
            <div key={field.name} className="contents">
              <dt className="text-zinc-600">{field.label}</dt>
              <dd>
                {Array.isArray(value) ? (
                  <ul className="list-disc pl-5">
                    {value.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                ) : field.type === "richtext" ? (
                  <div dangerouslySetInnerHTML={{ __html: sanitizeRichText(value) }} />
                ) : (
                  value
                )}
              </dd>
            </div>
          );
        })}
      </dl>

      <section>
        <h2 className="mb-2 text-lg font-semibold">History</h2>
        <ul className="text-sm text-zinc-700">
          {certificate.auditEntries.map((entry) => (
            <li key={String(entry.id)}>
              {entry.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC · {entry.action} by{" "}
              {entry.adminUser.email}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
