import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createPrismaClient, type PrismaClient } from "@moraspirit/db";
import type { FieldSchema } from "@moraspirit/shared";
import "./env";
import { computeDedupeKey } from "../lib/dedupe";
import { issueCertificate } from "../lib/issue-certificate";
import { PageOverflowError } from "../lib/pdf/render-pdf";

const schema: FieldSchema = [
  { name: "member_id", label: "Member ID", type: "text", required: true, dedupe: true },
  { name: "recipient_name", label: "Name", type: "text", required: true, public_summary: true },
  { name: "intro", label: "Intro", type: "richtext", required: false },
  { name: "points", label: "Points", type: "list", required: true },
];

let prisma: PrismaClient;
let adminId: number;
let templateId: number;
let versionId: number;
const suffix = randomBytes(4).toString("hex");
const raw = (memberId: string) => ({
  member_id: memberId,
  recipient_name: "Test Person",
  intro: "Hello <script>alert(1)</script> & <b>bold</b>",
  points: "• One\n\n• Two",
});
const okRender = vi.fn(async () => new Uint8Array([1]));

beforeAll(async () => {
  prisma = createPrismaClient({ connectionLimit: 2 });
  const admin = await prisma.adminUser.create({
    data: { email: `issue-test-${suffix}@example.test`, passwordHash: "not-a-real-hash" },
  });
  adminId = admin.id;
  const template = await prisma.template.create({
    data: { name: "Issue test", slug: `test-issue-${suffix}` },
  });
  templateId = template.id;
  const version = await prisma.templateVersion.create({
    data: {
      templateId,
      versionNumber: 1,
      htmlContent: "<p>{{recipient_name}}</p>",
      fieldSchema: schema as never,
      contentHash: randomBytes(32).toString("hex"),
    },
  });
  versionId = version.id;
  await prisma.template.update({
    where: { id: templateId },
    data: { currentVersionId: versionId },
  });
});

afterAll(async () => {
  const certificates = await prisma.certificate.findMany({
    where: { templateVersionId: versionId },
    select: { id: true },
  });
  const ids = certificates.map((c) => c.id);
  await prisma.certificateAudit.deleteMany({ where: { certificateId: { in: ids } } });
  await prisma.certificate.deleteMany({ where: { id: { in: ids } } });
  await prisma.template.update({ where: { id: templateId }, data: { currentVersionId: null } });
  await prisma.templateVersion.deleteMany({ where: { templateId } });
  await prisma.template.delete({ where: { id: templateId } });
  await prisma.adminUser.delete({ where: { id: adminId } });
  await prisma.$disconnect();
});

const issue = (memberId: string, extra: { confirmDuplicate?: boolean; renderPdf?: never } = {}) =>
  issueCertificate({
    prisma,
    adminId,
    templateId,
    rawValues: raw(memberId),
    confirmDuplicate: extra.confirmDuplicate ?? false,
    renderPdf: extra.renderPdf ?? okRender,
  });

describe("issueCertificate", () => {
  it("issues a certificate and leaves exactly one 'created' audit row, pinned to the current version", async () => {
    const result = await issue(`A-${suffix}`);
    expect(result.status).toBe("issued");
    if (result.status !== "issued") return;

    const certificate = await prisma.certificate.findUniqueOrThrow({ where: { id: result.id } });
    expect(certificate.templateVersionId).toBe(versionId);
    expect(certificate.status).toBe("active");
    expect(certificate.dedupeKey).toBe(
      computeDedupeKey(templateId, schema, { member_id: `A-${suffix}` }),
    );

    const audit = await prisma.certificateAudit.findMany({ where: { certificateId: result.id } });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ action: "created", adminUserId: adminId, oldData: null });
    expect(audit[0]!.newData).toEqual(certificate.data);
  });

  it("stores sanitized rich text and parsed list items", async () => {
    const result = await issue(`B-${suffix}`);
    if (result.status !== "issued") throw new Error("expected issued");
    const { data } = await prisma.certificate.findUniqueOrThrow({ where: { id: result.id } });
    expect(data).toMatchObject({ points: ["One", "Two"] });
    const intro = (data as Record<string, string>).intro!;
    expect(intro).not.toContain("<script");
    expect(intro).not.toContain("<b>");
    expect(intro).toContain("&amp;");
  });

  it("warns about a duplicate without writing, and issues anyway on confirmation", async () => {
    const member = `C-${suffix}`;
    expect((await issue(member)).status).toBe("issued");
    const before = await prisma.certificate.count({ where: { templateVersionId: versionId } });

    const warned = await issue(member.toUpperCase());
    expect(warned.status).toBe("duplicate");
    expect(await prisma.certificate.count({ where: { templateVersionId: versionId } })).toBe(
      before,
    );

    expect((await issue(member, { confirmDuplicate: true })).status).toBe("issued");
    expect(await prisma.certificate.count({ where: { templateVersionId: versionId } })).toBe(
      before + 1,
    );
  });

  it("returns field errors and writes nothing for invalid input", async () => {
    const before = await prisma.certificate.count({ where: { templateVersionId: versionId } });
    const result = await issueCertificate({
      prisma,
      adminId,
      templateId,
      rawValues: { member_id: "", recipient_name: "X", points: "" },
      confirmDuplicate: false,
      renderPdf: okRender,
    });
    expect(result).toMatchObject({
      status: "invalid",
      errors: { member_id: "Member ID is required", points: "Points is required" },
    });
    expect(await prisma.certificate.count({ where: { templateVersionId: versionId } })).toBe(
      before,
    );
  });

  it("issues nothing when the letter does not fit on one page", async () => {
    const before = await prisma.certificate.count({ where: { templateVersionId: versionId } });
    const overflow = vi.fn(async () => {
      throw new PageOverflowError(
        "Certificate for Test Person does not fit on one page. Shorten 'Points'.",
        "points",
      );
    });
    const result = await issue(`D-${suffix}`, { renderPdf: overflow as never });
    expect(result).toMatchObject({ status: "overflow", field: "points" });
    expect(await prisma.certificate.count({ where: { templateVersionId: versionId } })).toBe(
      before,
    );
    expect(
      await prisma.certificateAudit.count({
        where: { newData: { path: "$.member_id", equals: `D-${suffix}` } },
      }),
    ).toBe(0);
  });

  it("issues nothing when rendering fails for another reason", async () => {
    const before = await prisma.certificate.count({ where: { templateVersionId: versionId } });
    const broken = vi.fn(async () => {
      throw new Error("Chromium missing");
    });
    const result = await issue(`E-${suffix}`, { renderPdf: broken as never });
    expect(result.status).toBe("render_failed");
    expect(await prisma.certificate.count({ where: { templateVersionId: versionId } })).toBe(
      before,
    );
  });
});
