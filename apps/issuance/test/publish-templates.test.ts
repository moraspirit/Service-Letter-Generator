import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadTemplate } from "@moraspirit/certificate-templates";
import { createPrismaClient, type PrismaClient } from "@moraspirit/db";
import "./env";
import { publishTemplates, TemplateSafetyError } from "../lib/publish-templates";

const schema = {
  name: "Publish test",
  fields: [{ name: "a", label: "A", type: "text", required: true }],
};

let prisma: PrismaClient;
let dir: string;
const slugs: string[] = [];

function makeTemplate(html: string) {
  const slug = `test-publish-${randomBytes(4).toString("hex")}`;
  slugs.push(slug);
  mkdirSync(path.join(dir, slug));
  writeFileSync(path.join(dir, slug, "template.hbs"), html);
  writeFileSync(path.join(dir, slug, "schema.json"), JSON.stringify(schema));
  writeFileSync(path.join(dir, slug, "sample.json"), JSON.stringify({ a: "x" }));
  return slug;
}

beforeAll(() => {
  prisma = createPrismaClient({ connectionLimit: 2 });
  dir = mkdtempSync(path.join(tmpdir(), "tpl-"));
});

afterAll(async () => {
  for (const slug of slugs) {
    const t = await prisma.template.findUnique({ where: { slug } });
    if (!t) continue;
    await prisma.template.update({ where: { id: t.id }, data: { currentVersionId: null } });
    await prisma.templateVersion.deleteMany({ where: { templateId: t.id } });
    await prisma.template.delete({ where: { id: t.id } });
  }
  await prisma.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

describe("publishTemplates", () => {
  it("creates one version, skips an unchanged template, and versions a one-character change", async () => {
    const slug = makeTemplate("<p>{{a}}</p>");
    const load = () => loadTemplate(slug, dir);

    expect(await publishTemplates(prisma, [load()])).toEqual([
      { slug, status: "created", versionNumber: 1 },
    ]);
    expect(await publishTemplates(prisma, [load()])).toEqual([
      { slug, status: "unchanged", versionNumber: 1 },
    ]);

    const template = await prisma.template.findUniqueOrThrow({ where: { slug } });
    expect(await prisma.templateVersion.count({ where: { templateId: template.id } })).toBe(1);
    const v1 = await prisma.templateVersion.findFirstOrThrow({
      where: { templateId: template.id, versionNumber: 1 },
    });

    writeFileSync(path.join(dir, slug, "template.hbs"), "<p>{{a}}!</p>");
    expect(await publishTemplates(prisma, [load()])).toEqual([
      { slug, status: "updated", versionNumber: 2 },
    ]);

    const after = await prisma.template.findUniqueOrThrow({ where: { slug } });
    const v2 = await prisma.templateVersion.findFirstOrThrow({
      where: { templateId: template.id, versionNumber: 2 },
    });
    expect(after.currentVersionId).toBe(v2.id);

    // The old version is untouched.
    const v1Again = await prisma.templateVersion.findUniqueOrThrow({ where: { id: v1.id } });
    expect(v1Again.htmlContent).toBe("<p>{{a}}</p>");
    expect(v1Again.contentHash).toBe(v1.contentHash);
  });

  it("rejects an unsafe template and writes nothing, even for the safe ones in the same run", async () => {
    const safe = makeTemplate("<p>{{a}}</p>");
    const unsafe = makeTemplate("<p>{{a}}</p><script>alert(1)</script>");
    const batch = [loadTemplate(safe, dir), loadTemplate(unsafe, dir)];

    await expect(publishTemplates(prisma, batch)).rejects.toBeInstanceOf(TemplateSafetyError);
    expect(await prisma.template.count({ where: { slug: { in: [safe, unsafe] } } })).toBe(0);
  });
});
