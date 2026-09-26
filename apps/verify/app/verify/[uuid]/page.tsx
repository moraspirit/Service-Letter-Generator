import { notFound } from "next/navigation";
import { formatDate } from "@moraspirit/certificate-render";
import { Card, CardBody, DescriptionList, Icon } from "@moraspirit/ui";
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
  /** Ignored. `?full=1` used to open the letter; it is kept working so old links still resolve. */
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function VerifyPage({ params }: PageProps) {
  const { uuid } = await params;
  // A malformed id costs nothing: it never reaches the database.
  if (!isCertificateId(uuid)) notFound();

  const result = await loadCertificate(getDb(), uuid);
  if (result.kind === "not_found") notFound();

  // Status and date only. The data, template and revocation reason were never
  // loaded, so there is nothing else here to leak (architecture §6 D).
  if (result.kind === "revoked") {
    return (
      <div className="ms-verify-col flex flex-col gap-5">
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
  const fullHtml = await renderFullCertificate({
    id: uuid,
    htmlContent: result.htmlContent,
    fieldSchema: result.fieldSchema,
    data: result.data,
  });

  const facts = [
    ...summary,
    { label: "Issued", value: formatDate(result.issuedAt) },
    { label: "Status", value: "Active" },
  ];

  // The letter is what the person holding the printout is checking, so it opens on the
  // page itself, with the verdict first and the summary in a rail beside it. The rail also
  // lets the fixed-width page fit its column.
  return (
    <div className="flex flex-col gap-5">
      <Verdict
        tone="ok"
        icon="check"
        title="Verified — Authentic"
        note="This certificate is in MoraSpirit's records and is currently valid."
      />
      <div className="ms-full">
        <div className="ms-full-side">
          <Card>
            <CardBody>
              <h2 className="sr-only">Certificate summary</h2>
              <DescriptionList items={facts} />
            </CardBody>
          </Card>
          <p className="ms-verify-note flex items-start gap-2">
            <Icon name="info" size={16} />
            <span>
              Checked against MoraSpirit&apos;s records just now. Reload this page at any time to
              check again.
            </span>
          </p>
        </div>
        <section className="ms-letter-col" aria-label="Full certificate">
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
        </section>
      </div>
    </div>
  );
}
