// A scratch admin + template + version in the Aiven test database, removed afterwards.
import { randomBytes } from "node:crypto";
import { createPrismaClient, type PrismaClient } from "@moraspirit/db";
import type { FieldSchema } from "@moraspirit/shared";
import "./env";

export const fixtureSchema: FieldSchema = [
  { name: "member_id", label: "Member ID", type: "text", required: true, dedupe: true },
  { name: "recipient_name", label: "Name", type: "text", required: true, public_summary: true },
  { name: "notes", label: "Notes", type: "richtext", required: false },
  { name: "points", label: "Points", type: "list", required: true },
];

const STALE_AFTER_MS = 10 * 60 * 1000;

/**
 * Remove a scratch template and everything hanging off it, in foreign-key order.
 * Deliberately blunt: it deletes by template and by admin rather than by ids a
 * test remembered, so a run that died half way (pool timeout, failed assertion in
 * a hook) cannot leave rows that block the delete.
 */
async function purgeScratch(prisma: PrismaClient, templateId: number, adminId: number) {
  const versionIds = (
    await prisma.templateVersion.findMany({ where: { templateId }, select: { id: true } })
  ).map((v) => v.id);
  const certificateIds = (
    await prisma.certificate.findMany({
      where: { templateVersionId: { in: versionIds } },
      select: { id: true },
    })
  ).map((c) => c.id);

  await prisma.certificateAudit.deleteMany({
    where: { OR: [{ certificateId: { in: certificateIds } }, { adminUserId: adminId }] },
  });
  await prisma.certificate.deleteMany({ where: { id: { in: certificateIds } } });
  await prisma.importBatch.deleteMany({
    where: { OR: [{ templateVersionId: { in: versionIds } }, { adminUserId: adminId }] },
  });
  await prisma.template.update({ where: { id: templateId }, data: { currentVersionId: null } });
  await prisma.templateVersion.deleteMany({ where: { templateId } });
  await prisma.template.delete({ where: { id: templateId } });
  await prisma.adminUser.delete({ where: { id: adminId } });
}

/**
 * Sweep scratch data left behind by an earlier run that never reached its
 * cleanup. Only fixtures older than ten minutes, so a fixture that another file
 * is using right now is never touched.
 */
async function sweepStale(prisma: PrismaClient) {
  const cutoff = new Date(Date.now() - STALE_AFTER_MS);
  const stale = await prisma.template.findMany({
    where: { slug: { startsWith: "test-fixture-" }, createdAt: { lt: cutoff } },
    select: { id: true, slug: true },
  });
  for (const t of stale) {
    const admin = await prisma.adminUser.findUnique({
      where: { email: `fixture-${t.slug.slice("test-fixture-".length)}@example.test` },
      select: { id: true },
    });
    if (!admin) continue;
    await purgeScratch(prisma, t.id, admin.id).catch(() => undefined);
  }
}

export interface Fixture {
  prisma: PrismaClient;
  adminId: number;
  templateId: number;
  versionId: number;
  suffix: string;
  cleanup: () => Promise<void>;
}

export async function createFixture(
  schema: FieldSchema = fixtureSchema,
  html = "<p>{{recipient_name}}</p>",
): Promise<Fixture> {
  const prisma = createPrismaClient({ connectionLimit: 2 });
  await sweepStale(prisma).catch(() => undefined);
  const suffix = randomBytes(4).toString("hex");
  const admin = await prisma.adminUser.create({
    data: { email: `fixture-${suffix}@example.test`, passwordHash: "not-a-real-hash" },
  });
  const template = await prisma.template.create({
    data: { name: `Fixture ${suffix}`, slug: `test-fixture-${suffix}` },
  });
  const version = await prisma.templateVersion.create({
    data: {
      templateId: template.id,
      versionNumber: 1,
      htmlContent: html,
      fieldSchema: schema as never,
      contentHash: randomBytes(32).toString("hex"),
    },
  });
  await prisma.template.update({
    where: { id: template.id },
    data: { currentVersionId: version.id },
  });

  return {
    prisma,
    adminId: admin.id,
    templateId: template.id,
    versionId: version.id,
    suffix,
    cleanup: async () => {
      try {
        await purgeScratch(prisma, template.id, admin.id);
      } finally {
        await prisma.$disconnect();
      }
    },
  };
}
