import { notFound } from "next/navigation";
import { formatDate } from "@moraspirit/certificate-render";
import { CertificateStatusPill, Icon } from "@moraspirit/ui";
import { getDb } from "@/lib/db";
import { loadCertificate } from "@/lib/load-certificate";
import { buildSummary } from "@/lib/summary";
import { isCertificateId } from "@/lib/uuid";
import { Verdict } from "./verdict";

// Rendered on every request, never cached: a revocation or edit shows on the very next scan.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ uuid: string }>;
  /** Ignored. `?full=1` used to open the letter; old links still resolve to this page. */
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

  // Only the public details, read from the database: the template's `public_summary` fields,
  // the issue date and the status. The letter itself, its bullet points and its signatory are
  // never rendered here (owner's decision, 2026-10-06). There is no verdict badge for a valid
  // certificate either, so validity is stated by the Active pill, which carries an icon and a
  // word as well as colour.
  const rows = buildSummary(result.fieldSchema, result.data);
  // Whose record it is leads the card; everything else is a labelled fact beneath it.
  const subject = rows.find((r) => r.label.toLowerCase() === "name") ?? null;
  const facts = [
    ...rows.filter((r) => r !== subject),
    { label: "Issued", value: formatDate(result.issuedAt) },
  ];
  // Sri Lanka time, like every other date on the letter and this page.
  const checkedAt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Colombo",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(new Date())
    .replace(" at ", ", ");

  return (
    <div className="ms-verify-col flex flex-col gap-6">
      <header className="ms-portal-head">
        <p className="ms-portal-eyebrow">MoraSpirit</p>
        <h1 className="ms-portal-title">Online Verification Portal</h1>
        <p className="ms-portal-lede">
          This record was read from MoraSpirit&apos;s database when you opened this page.
        </p>
      </header>

      <article className="ms-record" aria-labelledby="record-subject">
        <div className="ms-record-head">
          <div className="ms-record-id">
            <p className="ms-record-kind">Certificate of Employment</p>
            <h2 id="record-subject" className="ms-record-subject">
              {subject?.value ?? "Certificate record"}
            </h2>
          </div>
          <CertificateStatusPill status="active" />
        </div>
        <dl className="ms-record-facts">
          {facts.map((f) => (
            <div key={f.label} className="ms-record-fact">
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
        <p className="ms-record-foot">
          <Icon name="clock" size={14} />
          <span>Checked {checkedAt} (Sri Lanka time). Reload this page to check again.</span>
        </p>
      </article>

      <p className="ms-verify-note">
        Compare these details with the printed letter. If anything differs, or you have a question,
        contact MoraSpirit at{" "}
        <a href="mailto:info@moraspirit.com" className="ms-link">
          info@moraspirit.com
        </a>
        .
      </p>
    </div>
  );
}
