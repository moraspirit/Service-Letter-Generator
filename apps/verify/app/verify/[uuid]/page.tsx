import { notFound } from "next/navigation";
import { formatDate } from "@moraspirit/certificate-render";
import { getDb } from "@/lib/db";
import { loadCertificate } from "@/lib/load-certificate";
import { renderFullCertificate } from "@/lib/render-full";
import { buildSummary } from "@/lib/summary";
import { isCertificateId } from "@/lib/uuid";
import { Icon } from "./icons";

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

  if (result.kind === "revoked") {
    return (
      <div className="flex flex-col gap-4">
        <div className="badge badge-bad" role="status">
          <Icon kind="revoked" />
          This certificate has been revoked
        </div>
        {result.revokedAt ? (
          <p className="note">Revoked on {formatDate(result.revokedAt)}.</p>
        ) : null}
        <p className="note">It is no longer valid.</p>
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

  return (
    <div className="flex flex-col gap-5">
      <div className="badge badge-ok" role="status">
        <Icon kind="check" />
        Verified — Authentic
      </div>

      <section className="card" aria-label="Certificate summary">
        <dl className="facts">
          {summary.map((row) => (
            <div key={row.label} className="contents">
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
          <div className="contents">
            <dt>Issued</dt>
            <dd>{formatDate(result.issuedAt)}</dd>
          </div>
          <div className="contents">
            <dt>Status</dt>
            <dd>Active</dd>
          </div>
        </dl>
      </section>

      <p className="note">
        This confirms the certificate is in MoraSpirit&apos;s records and is currently valid.
      </p>

      {fullHtml ? (
        <section className="flex flex-col gap-3" aria-label="Full certificate">
          <div className="letter-scroller">
            <iframe
              className="letter-frame"
              title="Full certificate"
              sandbox=""
              srcDoc={fullHtml}
              width={816}
              height={1056}
            />
          </div>
          <a className="link" href={`/verify/${uuid}`}>
            Hide the full certificate
          </a>
        </section>
      ) : (
        <div>
          <a className="button" href={`/verify/${uuid}?full=1`}>
            View full certificate
          </a>
        </div>
      )}
    </div>
  );
}
