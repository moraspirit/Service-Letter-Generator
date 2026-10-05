import { LinkButton } from "@moraspirit/ui";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { renderVersionPreview } from "@/lib/template-preview";
import { PageHeader } from "../_components/page-header";

export const dynamic = "force-dynamic";

/** When to use each letter, keyed by template folder. */
const WHEN: Record<string, string> = {
  "general-letter": "For a member who served with the pillar and completed its general tasks.",
  "special-letter":
    "For a member with notable contributions: adds a section listing what they did beyond their core role.",
};

export default async function DashboardPage() {
  const admin = await requireAdmin();

  const rows = await prisma.template.findMany({
    where: { currentVersionId: { not: null } },
    orderBy: { name: "asc" },
    include: { currentVersion: true },
  });
  const letters = rows.flatMap((t) =>
    t.currentVersion
      ? [
          {
            id: t.id,
            name: t.name,
            slug: t.slug,
            preview: renderVersionPreview(t.slug, t.currentVersion),
          },
        ]
      : [],
  );

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={`Welcome, ${admin.email.split("@")[0]}`}
        subtitle="Service letters are issued here and verified on the public site. Nothing is ever deleted — certificates are revoked instead, and every change is recorded."
      />

      <section aria-labelledby="letters-heading" className="flex flex-col gap-3">
        <h2 id="letters-heading" className="ms-section-title">
          Which letter?
        </h2>
        <ul className="ms-choices">
          {letters.map((l) => (
            <li key={l.id}>
              <article className="ms-choice ms-home-letter">
                <div className="ms-choice-thumb" aria-hidden="true">
                  <iframe
                    title={`${l.name} preview`}
                    sandbox=""
                    srcDoc={l.preview}
                    width={816}
                    height={1056}
                    tabIndex={-1}
                  />
                </div>
                <div className="ms-choice-body">
                  <h3 className="ms-choice-title">{l.name}</h3>
                  <p className="ms-help">{WHEN[l.slug] ?? ""}</p>
                  <div className="ms-actions ms-choice-cta">
                    <LinkButton
                      href={`/certificates/new?template=${l.id}`}
                      variant="primary"
                      icon="plus"
                    >
                      Issue one
                    </LinkButton>
                    <LinkButton
                      href={`/imports/new?template=${l.id}`}
                      variant="secondary"
                      icon="upload"
                    >
                      Import spreadsheet
                    </LinkButton>
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
