// The core of `pnpm templates:publish` (architecture §6 A). Kept free of I/O
// setup so tests can run it against a real database.
import { checkTemplateSafety, type LoadedTemplate } from "@moraspirit/certificate-templates";
import type { Prisma, PrismaClient } from "@moraspirit/db";

export type PublishOutcome =
  | { slug: string; status: "created"; versionNumber: number }
  | { slug: string; status: "updated"; versionNumber: number }
  | { slug: string; status: "unchanged"; versionNumber: number };

export class TemplateSafetyError extends Error {
  constructor(public readonly problems: { slug: string; rule: string; excerpt: string }[]) {
    super(
      "Unsafe template(s) rejected, nothing was published:\n" +
        problems.map((p) => `  ${p.slug}: ${p.rule} near "${p.excerpt}"`).join("\n"),
    );
  }
}

/**
 * Inserts a new immutable `template_versions` row for every template whose content
 * hash changed, and points `templates.current_version_id` at it. Unchanged
 * templates are skipped. Existing versions are never touched. All templates are
 * safety-checked before anything is written.
 */
export async function publishTemplates(
  prisma: PrismaClient,
  templates: readonly LoadedTemplate[],
): Promise<PublishOutcome[]> {
  const problems = templates.flatMap((t) =>
    checkTemplateSafety(t.htmlContent).map((v) => ({ slug: t.slug, ...v })),
  );
  if (problems.length > 0) throw new TemplateSafetyError(problems);

  const outcomes: PublishOutcome[] = [];
  for (const t of templates) {
    outcomes.push(
      await prisma.$transaction(async (tx) => {
        const existing = await tx.template.findUnique({ where: { slug: t.slug } });
        const template =
          existing ?? (await tx.template.create({ data: { slug: t.slug, name: t.name } }));
        if (existing && existing.name !== t.name) {
          await tx.template.update({ where: { id: existing.id }, data: { name: t.name } });
        }

        const latest = await tx.templateVersion.findFirst({
          where: { templateId: template.id },
          orderBy: { versionNumber: "desc" },
        });
        if (latest && latest.contentHash === t.contentHash) {
          return {
            slug: t.slug,
            status: "unchanged",
            versionNumber: latest.versionNumber,
          } as const;
        }

        const versionNumber = (latest?.versionNumber ?? 0) + 1;
        const version = await tx.templateVersion.create({
          data: {
            templateId: template.id,
            versionNumber,
            htmlContent: t.htmlContent,
            fieldSchema: t.fieldSchema as unknown as Prisma.InputJsonValue,
            contentHash: t.contentHash,
          },
        });
        await tx.template.update({
          where: { id: template.id },
          data: { currentVersionId: version.id },
        });
        return { slug: t.slug, status: latest ? "updated" : "created", versionNumber } as const;
      }),
    );
  }
  return outcomes;
}
