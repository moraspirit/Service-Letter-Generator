// Test data for the verify app. The verify app itself holds only read-only credentials, so the
// fixtures are written with the issuance app's read/write login, read from ITS env file at test
// time (never copied into this app's environment).
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import { createPrismaClient, type PrismaClient } from "@moraspirit/db";
import type { FieldSchema } from "@moraspirit/shared";

// The verify app's own env (verify_ro) for the code under test.
try {
  process.loadEnvFile(path.resolve(__dirname, "../.env.local"));
} catch {
  // Already provided by the environment (e.g. CI).
}

export const NARRATIVE = "NARRATIVE-MARKER-should-only-appear-in-the-full-certificate";
export const MEMBER_ID = "SECRETMEMBER42";
export const RECIPIENT = "Fake Recipient";
export const REVOKE_REASON = "REASON-MARKER-never-public";

export const schema: FieldSchema = [
  { name: "member_id", label: "Member ID", type: "text", required: true, dedupe: true },
  { name: "recipient_name", label: "Name", type: "text", required: true, public_summary: true },
  { name: "start_date", label: "Start date", type: "date", required: true, public_summary: true },
  { name: "story", label: "Story", type: "richtext", required: false },
  { name: "points", label: "Points", type: "list", required: true },
];

const html = `<!doctype html><html><head><style>@font-face{font-family:X;src:url(/certificate-assets/fonts/x.woff2)}</style></head><body><img src="/certificate-assets/mora-letterhead-v1.jpg"><p>{{recipient_name}}</p><div>{{{story}}}</div><ul>{{#each points}}<li>{{this}}</li>{{/each}}</ul></body></html>`;

export interface Seed {
  admin: PrismaClient;
  activeId: string;
  revokedId: string;
  cleanup: () => Promise<void>;
}

/** A fake template, one active and one revoked certificate. */
export async function seed(): Promise<Seed> {
  const issuanceEnv = parseEnv(
    readFileSync(path.resolve(__dirname, "../../issuance/.env.local"), "utf8"),
  );
  const admin = createPrismaClient({
    env: { ...process.env, ...issuanceEnv } as NodeJS.ProcessEnv,
    connectionLimit: 2,
  });
  const suffix = randomBytes(4).toString("hex");
  const adminUser = await admin.adminUser.create({
    data: { email: `verify-test-${suffix}@example.test`, passwordHash: "not-a-real-hash" },
  });
  const template = await admin.template.create({
    data: { name: `Verify test ${suffix}`, slug: `test-verify-${suffix}` },
  });
  const version = await admin.templateVersion.create({
    data: {
      templateId: template.id,
      versionNumber: 1,
      htmlContent: html,
      fieldSchema: schema as never,
      contentHash: randomBytes(32).toString("hex"),
    },
  });
  await admin.template.update({
    where: { id: template.id },
    data: { currentVersionId: version.id },
  });

  const data = {
    member_id: MEMBER_ID,
    recipient_name: RECIPIENT,
    start_date: "2025-04-28",
    story: `<p>${NARRATIVE}</p>`,
    points: ["one"],
  };
  const activeId = randomUUID();
  const revokedId = randomUUID();
  await admin.certificate.create({
    data: {
      id: activeId,
      templateVersionId: version.id,
      data,
      dedupeKey: randomBytes(32).toString("hex"),
    },
  });
  await admin.certificate.create({
    data: {
      id: revokedId,
      templateVersionId: version.id,
      data,
      dedupeKey: randomBytes(32).toString("hex"),
      status: "revoked",
      revokedAt: new Date("2025-06-01T10:00:00Z"),
      revocationReason: REVOKE_REASON,
    },
  });

  return {
    admin,
    activeId,
    revokedId,
    cleanup: async () => {
      await admin.certificate.deleteMany({ where: { id: { in: [activeId, revokedId] } } });
      await admin.template.update({ where: { id: template.id }, data: { currentVersionId: null } });
      await admin.templateVersion.deleteMany({ where: { templateId: template.id } });
      await admin.template.delete({ where: { id: template.id } });
      await admin.adminUser.delete({ where: { id: adminUser.id } });
      await admin.$disconnect();
    },
  };
}
