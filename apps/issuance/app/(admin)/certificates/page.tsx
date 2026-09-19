import Link from "next/link";
import { listCertificates } from "@/lib/certificate-list";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string; template?: string; status?: string; page?: string }>;

const field = "rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900";

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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Certificates</h1>
        <Link href="/certificates/new" className="text-red-700 hover:underline">
          Issue a certificate →
        </Link>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Member ID or name
          <input name="q" defaultValue={q} maxLength={100} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Template
          <select name="template" defaultValue={templateId ?? ""} className={field}>
            <option value="">All templates</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Status
          <select name="status" defaultValue={status ?? ""} className={field}>
            <option value="">Any</option>
            <option value="active">Active</option>
            <option value="revoked">Revoked</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded bg-zinc-800 px-4 py-2 text-sm font-medium text-white"
        >
          Search
        </button>
        {q || templateId || status ? (
          <Link href="/certificates" className="py-2 text-sm text-zinc-600 hover:underline">
            Clear
          </Link>
        ) : null}
      </form>

      <p className="text-sm text-zinc-600">
        {result.total} {result.total === 1 ? "certificate" : "certificates"}
      </p>

      {result.items.length === 0 ? (
        <p className="text-zinc-600">Nothing matches.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-300 text-zinc-600">
            <tr>
              <th className="py-2 pr-4">Member ID</th>
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Template</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2">Issued</th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((c) => {
              const data = c.data as Record<string, unknown>;
              return (
                <tr key={c.id} className="border-b border-zinc-200">
                  <td className="py-2 pr-4 font-mono text-xs">
                    <Link href={`/certificates/${c.id}`} className="text-red-700 hover:underline">
                      {String(data.member_id ?? c.id.slice(0, 8))}
                    </Link>
                  </td>
                  <td className="py-2 pr-4">{String(data.recipient_name ?? "")}</td>
                  <td className="py-2 pr-4">
                    {c.templateVersion.template.name} · v{c.templateVersion.versionNumber}
                  </td>
                  <td className="py-2 pr-4">
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        c.status === "active"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="py-2">{c.issuedAt.toISOString().slice(0, 10)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {result.pageCount > 1 ? (
        <nav className="flex items-center gap-4 text-sm" aria-label="Pagination">
          {result.page > 1 ? (
            <Link href={pageLink(result.page - 1)} className="text-red-700 hover:underline">
              ← Previous
            </Link>
          ) : null}
          <span className="text-zinc-600">
            Page {result.page} of {result.pageCount}
          </span>
          {result.page < result.pageCount ? (
            <Link href={pageLink(result.page + 1)} className="text-red-700 hover:underline">
              Next →
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
