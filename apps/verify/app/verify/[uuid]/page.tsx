import { notFound } from "next/navigation";
import { formatDate } from "@moraspirit/certificate-render";
import { Card, CardBody, DescriptionList, Icon, LinkButton } from "@moraspirit/ui";
import { getDb } from "@/lib/db";
import { loadCertificate } from "@/lib/load-certificate";
import { renderFullCertificate } from "@/lib/render-full";
import { buildSummary } from "@/lib/summary";
import { isCertificateId } from "@/lib/uuid";
import { Verdict } from "./verdict";

// Rendered on every request, never cached: a revocation or edit shows on the very next scan.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ uuid: string }>;
  searchParams: Promise<{ full?: string | string[] }>;
}

export default async function VerifyPage({ params, searchParams }: PageProps) {
  const { uuid } = await params;
  // A malformed id costs nothing: it never reaches the database.
  if (!isCertificateId(uuid)) notFound();

  const wantsFull = (await searchParams).full === "1";
  const result = await loadCertificate(getDb(), uuid, { withHtml: wantsFull });
  if (result.kind === "not_found") notFound();

  // Status and date only. The data, template and revocation reason were never
  // loaded, so there is nothing else here to leak (architecture §6 D).
  if (result.kind === "revoked") {
    return (
      <div className="flex flex-col gap-5">
        <Verdict
          tone="bad"
          icon="revoked"
          title="This certificate has been revoked"
          note={
            result.revokedAt
              ? `Revoked on ${formatDate(result.revokedAt)}. It is no longer valid.`
              : "It is no longer valid."
          }
        />
        <p className="ms-verify-note">
          MoraSpirit withdrew this certificate after it was issued. If you were given it as proof of
          service, treat it as void and contact MoraSpirit at info@moraspirit.com.
        </p>
      </div>
    );
  }

  const summary = buildSummary(result.fieldSchema, result.data);
  const fullHtml =
    wantsFull && result.htmlContent
      ? await renderFullCertificate({
          id: uuid,
          htmlContent: result.htmlContent,
          fieldSchema: result.fieldSchema,
          data: result.data,
        })
      : null;

  const facts = [
    ...summary,
    { label: "Issued", value: formatDate(result.issuedAt) },
    { label: "Status", value: "Active" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <Verdict
        tone="ok"
        icon="check"
        title="Verified — Authentic"
        note="This certificate is in MoraSpirit's records and is currently valid."
      />

      <Card>
        <CardBody>
          <h2 className="sr-only">Certificate summary</h2>
          <DescriptionList items={facts} />
        </CardBody>
      </Card>

      {fullHtml ? (
        <section className="flex flex-col gap-3" aria-label="Full certificate">
          <div className="ms-letter-wrap">
            <iframe
              className="ms-letter"
              title="Full certificate"
              sandbox=""
              srcDoc={fullHtml}
              width={816}
              height={1056}
            />
          </div>
          <div>
            <LinkButton href={`/verify/${uuid}`} icon="eyeOff" variant="secondary">
              Hide the full certificate
            </LinkButton>
          </div>
        </section>
      ) : (
        <div className="flex flex-col gap-2">
          <LinkButton
            href={`/verify/${uuid}?full=1`}
            variant="primary"
            size="lg"
            icon="eye"
            className="self-start"
          >
            View full certificate
          </LinkButton>
          <p className="ms-verify-note">
            Opens the letter itself, exactly as MoraSpirit issued it.
          </p>
        </div>
      )}

      <p className="ms-verify-note flex items-start gap-2">
        <Icon name="info" size={16} />
        <span>
          Checked against MoraSpirit&apos;s records just now. Reload this page at any time to check
          again.
        </span>
      </p>
    </div>
  );
}
