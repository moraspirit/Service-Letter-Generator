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
      const ids = (
        await prisma.certificate.findMany({
          where: { templateVersion: { templateId: template.id } },
          select: { id: true },
        })
      ).map((c) => c.id);
      await prisma.certificateAudit.deleteMany({ where: { certificateId: { in: ids } } });
      await prisma.certificate.deleteMany({ where: { id: { in: ids } } });
      await prisma.template.update({
        where: { id: template.id },
        data: { currentVersionId: null },
      });
      await prisma.templateVersion.deleteMany({ where: { templateId: template.id } });
      await prisma.template.delete({ where: { id: template.id } });
      await prisma.adminUser.delete({ where: { id: admin.id } });
      await prisma.$disconnect();
    },
  };
}
