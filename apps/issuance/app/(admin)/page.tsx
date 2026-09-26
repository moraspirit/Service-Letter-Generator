import Link from "next/link";
import { CertificateStatusPill, Icon, type IconName } from "@moraspirit/ui";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { PageHeader } from "../_components/page-header";

export const dynamic = "force-dynamic";

/**
 * The starting point for someone who last used this tool months ago. It offers
 * the three things they came to do and shows the most recent work, rather than
 * a wall of counts nobody acts on.
 */
const TASKS: { href: string; icon: IconName; title: string; body: string }[] = [
  {
    href: "/certificates/new",
    icon: "plus",
    title: "Issue one certificate",
    body: "Fill in the form for a single recipient and watch the letter build beside it.",
  },
  {
    href: "/imports/new",
    icon: "upload",
    title: "Import a spreadsheet",
    body: "Check an .xlsx or .csv row by row, then issue the whole batch at once.",
  },
  {
    href: "/certificates",
    icon: "search",
    title: "Find a certificate",
    body: "Search by member ID or name to download, correct or revoke a letter.",
  },
];

export default async function DashboardPage() {
  const admin = await requireAdmin();

  const recent = await prisma.certificate.findMany({
    orderBy: { issuedAt: "desc" },
    take: 6,
    select: {
      id: true,
      data: true,
      status: true,
      issuedAt: true,
      templateVersion: { select: { template: { select: { name: true } } } },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Welcome, ${admin.email.split("@")[0]}`}
        subtitle="Service letters are issued here and verified on the public site. Nothing is ever deleted — certificates are revoked instead, and every change is recorded."
      />

      <section aria-label="Tasks" className="ms-tasks">
        {TASKS.map((task) => (
          <Link key={task.href} href={task.href} className="ms-task">
            <span className="ms-task-icon">
              <Icon name={task.icon} size={18} />
            </span>
            <span className="ms-task-title">
              {task.title}
              <Icon name="arrowRight" size={14} />
            </span>
            <span className="ms-task-body">{task.body}</span>
          </Link>
        ))}
      </section>

      <section aria-labelledby="recent-heading" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <h2 id="recent-heading" className="ms-section-title">
            Recently issued
          </h2>
          <Link href="/certificates" className="ms-link ms-link-sm">
            All certificates
          </Link>
        </div>

        {recent.length === 0 ? (
          <p className="ms-help">
            No certificates yet. Issuing one, or importing a spreadsheet, will fill this list.
          </p>
        ) : (
          <div className="ms-table-wrap">
            <table className="ms-table ms-table-hover">
              <caption className="sr-only">Most recently issued certificates</caption>
              <thead>
                <tr>
                  <th scope="col">Recipient</th>
                  <th scope="col">Member ID</th>
                  <th scope="col">Template</th>
                  <th scope="col">Issued</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((c) => {
                  const data = c.data as Record<string, unknown>;
                  return (
                    <tr key={c.id}>
                      <td className="ms-cell-name">
                        {String(data.recipient_name ?? "Unnamed recipient")}
                      </td>
                      <td>
                        <Link href={`/certificates/${c.id}`} className="ms-mono ms-cell-link">
                          {String(data.member_id ?? c.id.slice(0, 8))}
                        </Link>
                      </td>
                      <td>{c.templateVersion.template.name}</td>
                      <td className="ms-tnum ms-cell-dim">
                        {c.issuedAt.toISOString().slice(0, 10)}
                      </td>
                      <td>
                        <CertificateStatusPill status={c.status as "active" | "revoked"} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
