import Link from "next/link";
import { Icon, type IconName } from "@moraspirit/ui";
import { requireAdmin } from "@/lib/require-admin";
import { PageHeader } from "../_components/page-header";

export const dynamic = "force-dynamic";

/**
 * The starting point for someone who last used this tool months ago. It offers
 * the three things they came to do, rather than a wall of counts nobody acts on.
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
    </div>
  );
}
