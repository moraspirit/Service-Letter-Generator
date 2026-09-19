import Link from "next/link";
import { notFound } from "next/navigation";
import type { CertificateData, FieldSchema } from "@moraspirit/shared";
import { prisma } from "@/lib/db";
import { describeChanges } from "@/lib/audit-diff";
import { requireAdmin } from "@/lib/require-admin";
import { sanitizeRichText } from "@/lib/sanitize";
import { StatusActions } from "./status-actions";
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
        <Link href="/certificates" className="text-sm text-red-700 hover:underline">
          ← All certificates
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
        {certificate.status === "active" ? (
          <Link
            href={`/certificates/${certificate.id}/edit`}
            className="rounded border border-zinc-300 px-4 py-2 font-medium"
          >
            Edit
          </Link>
        ) : null}
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

      {certificate.status === "revoked" ? (
        <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          Revoked {certificate.revokedAt ? certificate.revokedAt.toISOString().slice(0, 10) : ""}
          {certificate.revocationReason ? `: ${certificate.revocationReason}` : ""}. Visitors who
          scan its QR code see that it is revoked. Its details are not shown to them.
        </p>
      ) : null}

      <StatusActions certificateId={certificate.id} status={certificate.status} />

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
        <ol className="flex flex-col gap-3 text-sm">
          {certificate.auditEntries.map((entry) => {
            const changes =
              entry.action === "edited"
                ? describeChanges(
                    schema,
                    entry.oldData as unknown as CertificateData | null,
                    entry.newData as unknown as CertificateData | null,
                  )
                : [];
            return (
              <li key={String(entry.id)} className="border-l-2 border-zinc-300 pl-3">
                <p>
                  <span className="font-medium">{entry.action}</span> by {entry.adminUser.email} ·{" "}
                  {entry.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC
                </p>
                {entry.reason ? <p className="text-zinc-700">Reason: {entry.reason}</p> : null}
                {changes.length > 0 ? (
                  <ul className="mt-1 flex flex-col gap-1">
                    {changes.map((c) => (
                      <li key={c.label}>
                        <span className="text-zinc-600">{c.label}:</span>{" "}
                        <span className="whitespace-pre-wrap text-red-800 line-through">
                          {c.before}
                        </span>{" "}
                        → <span className="whitespace-pre-wrap text-green-800">{c.after}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
