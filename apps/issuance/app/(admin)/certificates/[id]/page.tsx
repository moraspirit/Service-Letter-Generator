import { notFound } from "next/navigation";
import type { CertificateData, FieldSchema } from "@moraspirit/shared";
import {
  Banner,
  Card,
  CardBody,
  CardHead,
  CertificateStatusPill,
  DescriptionList,
  Icon,
  LinkButton,
} from "@moraspirit/ui";
import { prisma } from "@/lib/db";
import { describeChanges } from "@/lib/audit-diff";
import { requireAdmin } from "@/lib/require-admin";
import { sanitizeRichText } from "@/lib/sanitize";
import { PageHeader } from "../../../_components/page-header";
import { StatusActions } from "./status-actions";
import { buildVerifyUrl, UUID_PATTERN, VerifyUrlError } from "@/lib/verify-url";

export const dynamic = "force-dynamic";

const ACTION_ICON = {
  created: "plus",
  edited: "edit",
  revoked: "revoked",
  restored: "check",
} as const;

function utc(date: Date): string {
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

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
  const status = certificate.status as "active" | "revoked";
  const name = typeof data.recipient_name === "string" ? data.recipient_name : "Certificate";

  let verifyUrl: string | null = null;
  let verifyProblem: string | null = null;
  try {
    verifyUrl = buildVerifyUrl(certificate.id);
  } catch (error) {
    verifyProblem =
      error instanceof VerifyUrlError ? error.message : "Verification URL unavailable";
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        crumbs={[{ label: "Certificates", href: "/certificates" }, { label: name }]}
        title={name}
        subtitle={
          <>
            {certificate.templateVersion.template.name} · v
            {certificate.templateVersion.versionNumber} · issued {utc(certificate.issuedAt)}
          </>
        }
        actions={
          <>
            {status === "active" ? (
              <LinkButton
                href={`/certificates/${certificate.id}/edit`}
                variant="secondary"
                icon="edit"
              >
                Edit
              </LinkButton>
            ) : null}
            <LinkButton
              href={`/certificates/${certificate.id}/pdf`}
              variant="primary"
              icon="download"
            >
              Download PDF
            </LinkButton>
          </>
        }
      />

      {status === "revoked" ? (
        <Banner tone="bad" title="This certificate is revoked">
          <p>
            Revoked {certificate.revokedAt ? certificate.revokedAt.toISOString().slice(0, 10) : ""}
            {certificate.revocationReason ? ` — ${certificate.revocationReason}` : ""}. Anyone
            scanning its QR code is told it is no longer valid; they are never shown the reason or
            the certificate&apos;s contents.
          </p>
        </Banner>
      ) : null}

      <div className="ms-detail">
        <div className="flex flex-col gap-5">
          <Card>
            <CardHead title="Certificate contents" />
            <CardBody>
              <DescriptionList
                items={schema.flatMap((field) => {
                  const value = data[field.name];
                  if (
                    value === undefined ||
                    value === "" ||
                    (Array.isArray(value) && value.length === 0)
                  ) {
                    return [];
                  }
                  return [
                    {
                      label: field.label,
                      value: Array.isArray(value) ? (
                        <ul className="ms-bullets">
                          {value.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      ) : field.type === "richtext" ? (
                        <div
                          className="ms-richtext"
                          dangerouslySetInnerHTML={{ __html: sanitizeRichText(value) }}
                        />
                      ) : (
                        value
                      ),
                    },
                  ];
                })}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHead title="History" />
            <CardBody>
              <ol className="ms-timeline">
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
                    <li key={String(entry.id)}>
                      <span className="ms-timeline-marker">
                        <Icon
                          name={ACTION_ICON[entry.action as keyof typeof ACTION_ICON] ?? "info"}
                          size={12}
                        />
                      </span>
                      <div className="ms-timeline-body">
                        <p className="ms-timeline-head">
                          <span className="ms-timeline-action">{entry.action}</span>
                          <span className="ms-timeline-meta">
                            {entry.adminUser.email} · {utc(entry.createdAt)}
                          </span>
                        </p>
                        {entry.reason ? <p className="ms-timeline-reason">{entry.reason}</p> : null}
                        {changes.length > 0 ? (
                          <ul className="ms-changes">
                            {changes.map((c) => (
                              <li key={c.label}>
                                <span className="ms-changes-label">{c.label}</span>
                                <del>{c.before}</del>
                                <Icon name="arrowRight" size={12} />
                                <ins>{c.after}</ins>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </CardBody>
          </Card>
        </div>

        <aside className="flex flex-col gap-5">
          <Card>
            <CardHead title="Record" actions={<CertificateStatusPill status={status} />} />
            <CardBody>
              <DescriptionList
                className="ms-dl-stack"
                items={[
                  {
                    label: "Certificate ID",
                    value: <span className="ms-mono">{certificate.id}</span>,
                  },
                  {
                    label: "Template",
                    value: `${certificate.templateVersion.template.name} · v${certificate.templateVersion.versionNumber}`,
                  },
                  { label: "Issued", value: utc(certificate.issuedAt) },
                  {
                    label: "Verification link",
                    value: verifyUrl ? (
                      <a
                        className="ms-link ms-mono ms-break"
                        href={verifyUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {verifyUrl}
                      </a>
                    ) : (
                      <span className="ms-error">{verifyProblem}</span>
                    ),
                  },
                ]}
              />
            </CardBody>
          </Card>

          <StatusActions certificateId={certificate.id} status={status} />
        </aside>
      </div>
    </div>
  );
}
