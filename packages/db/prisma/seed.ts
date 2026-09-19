/**
 * Rebuild the development dataset in one command.
 *
 *   pnpm db:seed              wipe the seeded tables and insert fresh fixtures
 *   pnpm db:seed --keep       insert without wiping (fails on existing unique rows)
 *
 * Everything here is FABRICATED. Never seed a database with real recipient
 * names, and never run this against production (AGENTS.md §7): it deletes every
 * row in the application tables.
 *
 * The fixtures deliberately exercise the invariants later phases depend on:
 *   - a template with TWO versions, and a certificate pinned to the older one,
 *     so version pinning is visible in development from day one;
 *   - active and revoked certificates, each with the audit rows that
 *     architecture §4 requires for every state change;
 *   - one manually issued certificate and one import batch.
 */

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { hash } from "@node-rs/argon2";

import { PrismaClient } from "../generated/prisma/client.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.resolve(HERE, "..");
const ROOT = path.resolve(PKG, "..", "..");

const KEEP = process.argv.includes("--keep");

// Development-only credentials. Fine to have in the repository: they only ever
// unlock a throwaway database full of invented people.
const ADMIN_EMAIL = "admin@moraspirit.test";
const ADMIN_PASSWORD = "development-only-password";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const p = path.join(PKG, file);
    if (fs.existsSync(p)) dotenv.config({ path: p });
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set (packages/db/.env.local).");
  }
  return new URL(process.env.DATABASE_URL);
}

function caCertificate() {
  const configured = process.env.NODE_EXTRA_CA_CERTS;
  const p = configured ? path.resolve(PKG, configured) : path.join(ROOT, ".cert", "ca.pem");
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : undefined;
}

/** Same shape the application will use: template id + the dedupe-flagged values. */
const dedupeKey = (templateId, values) =>
  createHash("sha256")
    .update([templateId, ...values].map((v) => String(v).trim().toLowerCase()).join("|"))
    .digest("hex");

const contentHash = (html, schema) =>
  createHash("sha256").update(html).update(JSON.stringify(schema)).digest("hex");

// --- fixture content --------------------------------------------------------
// A stand-in for the real service letter, which arrives in Phase 1. Kept
// minimal on purpose: this exists to give the tables realistic shapes, not to
// look like the finished certificate.

const FIELD_SCHEMA = [
  { name: "member_id", label: "Member ID", type: "text", required: true, dedupe: true },
  {
    name: "recipient_name",
    label: "Recipient name",
    type: "text",
    required: true,
    public_summary: true,
  },
  {
    name: "honorific",
    label: "Honorific",
    type: "select",
    required: true,
    options: ["Mr.", "Ms.", "Mx."],
  },
  { name: "pillar_name", label: "Pillar", type: "text", required: true, public_summary: true },
  { name: "start_date", label: "Start date", type: "date", required: true, public_summary: true },
  { name: "end_date", label: "End date", type: "date", required: true, public_summary: true },
  { name: "general_points", label: "General points", type: "list", required: true },
  { name: "special_points", label: "Special points", type: "list", required: false },
];

const TEMPLATE_V1 = `<article class="letter">
  <h1>Certificate of Employment</h1>
  <p>This letter confirms that {{honorific}} {{recipient_name}} served with MoraSpirit
     Organization as a member of the {{pillar_name}} from {{formatDate start_date}}
     to {{formatDate end_date}}.</p>
  <ul>{{#each general_points}}<li>{{this}}</li>{{/each}}</ul>
</article>`;

const TEMPLATE_V2 = `${TEMPLATE_V1.replace("</article>", "")}
  {{#if special_points}}
    <p>{{pronoun_subject}} also contributed to the following:</p>
    <ul>{{#each special_points}}<li>{{this}}</li>{{/each}}</ul>
  {{/if}}
</article>`;

const GENERAL_POINTS = [
  "Demonstrated commitment and responsibility in carrying out assigned tasks.",
  "Collaborated with fellow members to coordinate pillar initiatives.",
];

// Invented people. Any resemblance to a real member is unintended.
const PEOPLE = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    member_id: "TST0001",
    recipient_name: "Avery Fictional",
    honorific: "Mr.",
    special: null,
    status: "active",
    onOldVersion: true,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    member_id: "TST0002",
    recipient_name: "Blair Imaginary",
    honorific: "Ms.",
    special: ["Served as co-chairperson of a sample project."],
    status: "active",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    member_id: "TST0003",
    recipient_name: "Charlie Placeholder",
    honorific: "Mx.",
    special: null,
    status: "active",
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    member_id: "TST0004",
    recipient_name: "Dakota Sample",
    honorific: "Ms.",
    special: ["Led the marketing committee for a sample event."],
    status: "revoked",
  },
];

async function wipe(prisma) {
  // Child rows first: every one of these has a foreign key into the next.
  await prisma.certificateAudit.deleteMany();
  await prisma.certificate.deleteMany();
  await prisma.importBatch.deleteMany();
  await prisma.$executeRawUnsafe("UPDATE templates SET current_version_id = NULL");
  await prisma.templateVersion.deleteMany();
  await prisma.template.deleteMany();
  await prisma.loginAttempt.deleteMany();
  await prisma.adminUser.deleteMany();
}

async function seed(prisma) {
  const admin = await prisma.adminUser.create({
    data: {
      email: ADMIN_EMAIL,
      // argon2id, as architecture §9 requires — the same algorithm Phase 2 will
      // verify against, so the seeded account works with the real login.
      passwordHash: await hash(ADMIN_PASSWORD),
    },
  });

  const template = await prisma.template.create({ data: { name: "Service letter (fixture)" } });

  const v1 = await prisma.templateVersion.create({
    data: {
      templateId: template.id,
      versionNumber: 1,
      htmlContent: TEMPLATE_V1,
      fieldSchema: FIELD_SCHEMA.filter((f) => f.name !== "special_points"),
      contentHash: contentHash(TEMPLATE_V1, FIELD_SCHEMA),
    },
  });

  const v2 = await prisma.templateVersion.create({
    data: {
      templateId: template.id,
      versionNumber: 2,
      htmlContent: TEMPLATE_V2,
      fieldSchema: FIELD_SCHEMA,
      contentHash: contentHash(TEMPLATE_V2, FIELD_SCHEMA),
    },
  });

  await prisma.template.update({
    where: { id: template.id },
    data: { currentVersionId: v2.id },
  });

  const batch = await prisma.importBatch.create({
    data: {
      templateVersionId: v2.id,
      fileName: "fixture-batch.xlsx",
      fileType: "xlsx",
      sheetName: "Sheet1",
      fileHash: createHash("sha256").update("fixture-batch").digest("hex"),
      rowCount: 2,
      insertedCount: 2,
      skippedCount: 0,
      adminUserId: admin.id,
    },
  });

  for (const [index, person] of PEOPLE.entries()) {
    const fromImport = index >= 2; // first two manual, rest from the batch
    const data = {
      member_id: person.member_id,
      recipient_name: person.recipient_name,
      honorific: person.honorific,
      pillar_name: "Sample Projects Pillar",
      start_date: "2025-04-28",
      end_date: "2026-04-29",
      general_points: GENERAL_POINTS,
      ...(person.special ? { special_points: person.special } : {}),
    };

    await prisma.certificate.create({
      data: {
        id: person.id,
        // One certificate stays on version 1: proof that issued certificates do
        // not follow the template forward.
        templateVersionId: person.onOldVersion ? v1.id : v2.id,
        data,
        importBatchId: fromImport ? batch.id : null,
        dedupeKey: dedupeKey(template.id, [person.member_id]),
        status: person.status,
        revokedAt: person.status === "revoked" ? new Date() : null,
        revocationReason: person.status === "revoked" ? "Fixture: issued in error" : null,
        auditEntries: {
          create: [
            { action: "created", newData: data, adminUserId: admin.id },
            ...(person.status === "revoked"
              ? [
                  {
                    action: "revoked",
                    reason: "Fixture: issued in error",
                    adminUserId: admin.id,
                  },
                ]
              : []),
          ],
        },
      },
    });
  }

  return { admin, template, versions: [v1, v2], batch };
}

async function main() {
  const url = loadEnv();
  const ca = caCertificate();

  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed: NODE_ENV=production. This deletes every application row.");
  }

  console.log(`Seeding ${url.pathname.slice(1)} at ${url.hostname}`);
  console.log(`Mode: ${KEEP ? "insert only" : "wipe and insert"}\n`);

  const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: Number(url.port),
    user: url.username,
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    ...(ca ? { ssl: { ca } } : {}),
  });
  const prisma = new PrismaClient({ adapter });

  try {
    if (!KEEP) await wipe(prisma);
    await seed(prisma);

    const counts = {
      adminUsers: await prisma.adminUser.count(),
      templates: await prisma.template.count(),
      templateVersions: await prisma.templateVersion.count(),
      certificates: await prisma.certificate.count(),
      revoked: await prisma.certificate.count({ where: { status: "revoked" } }),
      importBatches: await prisma.importBatch.count(),
      auditEntries: await prisma.certificateAudit.count(),
    };
    for (const [key, value] of Object.entries(counts)) {
      console.log(`  ${key.padEnd(18)} ${value}`);
    }

    console.log(`\nAdmin login for development: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
    console.log("Verify pages (once Phase 7 exists):");
    for (const person of PEOPLE) {
      console.log(`  /verify/${person.id}  ${person.recipient_name} (${person.status})`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(`\n✖ Seed failed: ${error.message}\n`);
  process.exit(1);
});
