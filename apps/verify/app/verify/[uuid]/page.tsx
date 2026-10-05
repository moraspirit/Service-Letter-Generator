import { notFound } from "next/navigation";
import { formatDate } from "@moraspirit/certificate-render";
import {
  Card,
  CardBody,
  CardHead,
  CertificateStatusPill,
  DescriptionList,
  Icon,
} from "@moraspirit/ui";
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
  // never rendered here (owner's decision, 2026-10-06; the page showed the whole letter from
  // 2026-09-26). There is no verdict badge for a valid certificate either, so the status is
  // stated as a pill with an icon and a word.
  const facts = [
    ...buildSummary(result.fieldSchema, result.data),
    { label: "Issued", value: formatDate(result.issuedAt) },
    { label: "Status", value: <CertificateStatusPill status="active" /> },
  ];

  return (
    <div className="ms-verify-col flex flex-col gap-5">
      <h1 className="ms-portal-title">MoraSpirit Online Verification Portal</h1>
      <Card>
        <CardHead title="Certificate record" />
        <CardBody>
          <DescriptionList items={facts} />
        </CardBody>
      </Card>
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
