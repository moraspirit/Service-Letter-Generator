import Link from "next/link";
import {
  Button,
  CertificateStatusPill,
  EmptyState,
  Icon,
  LinkButton,
  StatusPill,
} from "@moraspirit/ui";
import { listCertificates } from "@/lib/certificate-list";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { PageHeader } from "../../_components/page-header";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string; template?: string; status?: string; page?: string }>;

export default async function CertificatesPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();

  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 100);
  const templateId = Number(params.template) > 0 ? Number(params.template) : undefined;
  const status =
    params.status === "active" || params.status === "revoked" ? params.status : undefined;
  const page = Number(params.page) > 0 ? Math.floor(Number(params.page)) : 1;

  const [templates, result] = await Promise.all([
    prisma.template.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    listCertificates(prisma, { q, templateId, status, page }),
  ]);

  const filtered = Boolean(q || templateId || status);

  const pageLink = (target: number) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (templateId) next.set("template", String(templateId));
    if (status) next.set("status", status);
    if (target > 1) next.set("page", String(target));
    const qs = next.toString();
    return `/certificates${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Certificates"
        subtitle="Every letter ever issued, including revoked ones. Open a certificate to download it, correct it, or withdraw it."
        actions={
          <LinkButton href="/certificates/new" variant="primary" icon="plus">
            Issue certificate
          </LinkButton>
        }
      />

      <form method="get" className="ms-toolbar" role="search">
        <div className="ms-field">
          <label className="ms-label" htmlFor="q">
            Member ID or name
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            maxLength={100}
            placeholder="e.g. TST0001 or Avery"
            className="ms-input"
          />
        </div>
        <div className="ms-field">
          <label className="ms-label" htmlFor="template">
            Template
          </label>
          <select
            id="template"
            name="template"
            defaultValue={templateId ?? ""}
            className="ms-select"
          >
            <option value="">All templates</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="ms-field">
          <label className="ms-label" htmlFor="status">
            Status
          </label>
          <select id="status" name="status" defaultValue={status ?? ""} className="ms-select">
            <option value="">Any</option>
            <option value="active">Active</option>
            <option value="revoked">Revoked</option>
          </select>
        </div>
        <div className="ms-toolbar-actions">
          <Button type="submit" variant="secondary" icon="search">
            Search
          </Button>
          {filtered ? (
            <Link href="/certificates" className="ms-btn ms-btn-ghost">
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      <p className="ms-help" role="status">
        {result.total} {result.total === 1 ? "certificate" : "certificates"}
        {filtered ? " match these filters" : ""}
      </p>

      {result.items.length === 0 ? (
        filtered ? (
          <EmptyState
            icon="search"
            title="Nothing matches these filters"
            action={
              <Link href="/certificates" className="ms-btn ms-btn-secondary ms-btn-sm">
                Clear filters
              </Link>
            }
          >
            Search matches a member ID or a recipient&apos;s name. Partial words work, so
            &ldquo;Ave&rdquo; finds &ldquo;Avery&rdquo;.
          </EmptyState>
        ) : (
          <EmptyState
            icon="file"
            title="No certificates yet"
            action={
              <LinkButton href="/certificates/new" variant="primary" size="sm" icon="plus">
                Issue the first certificate
              </LinkButton>
            }
          >
            Issue one at a time, or import a spreadsheet to create a whole batch. Every certificate
            issued here gets a QR code that verifies against this database.
          </EmptyState>
        )
      ) : (
        <div className="ms-table-wrap">
          <table className="ms-table ms-table-hover">
            <caption className="sr-only">Issued certificates</caption>
            <thead>
              <tr>
                <th scope="col">Member ID</th>
                <th scope="col">Recipient</th>
                <th scope="col">Template</th>
                <th scope="col">Status</th>
                <th scope="col">Issued</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((c) => {
                const data = c.data as Record<string, unknown>;
                return (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/certificates/${c.id}`} className="ms-mono ms-cell-link">
                        {String(data.member_id ?? c.id.slice(0, 8))}
                      </Link>
                    </td>
                    <td className="ms-cell-name">{String(data.recipient_name ?? "—")}</td>
                    <td>
                      {c.templateVersion.template.name}{" "}
                      <span className="ms-cell-dim">v{c.templateVersion.versionNumber}</span>
                    </td>
                    <td>
                      <CertificateStatusPill status={c.status as "active" | "revoked"} />
                    </td>
                    <td className="ms-tnum ms-cell-dim">{c.issuedAt.toISOString().slice(0, 10)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {result.pageCount > 1 ? (
        <nav className="ms-pagination" aria-label="Pagination">
          {result.page > 1 ? (
            <Link href={pageLink(result.page - 1)} className="ms-btn ms-btn-secondary ms-btn-sm">
              <Icon name="arrowLeft" />
              Previous
            </Link>
          ) : (
            <span />
          )}
          <StatusPill tone="neutral">
            Page {result.page} of {result.pageCount}
          </StatusPill>
          {result.page < result.pageCount ? (
            <Link href={pageLink(result.page + 1)} className="ms-btn ms-btn-secondary ms-btn-sm">
              Next
              <Icon name="arrowRight" />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
