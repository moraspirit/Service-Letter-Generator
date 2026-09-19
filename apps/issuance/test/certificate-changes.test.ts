import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { editCertificate, restoreCertificate, revokeCertificate } from "../lib/certificate-changes";
import { issueCertificate } from "../lib/issue-certificate";
import { PageOverflowError } from "../lib/pdf/render-pdf";
import { createFixture, type Fixture } from "./fixtures";

let f: Fixture;
const okRender = vi.fn(async () => new Uint8Array([1]));

const raw = (member: string, extra: Record<string, string> = {}) => ({
  member_id: member,
  recipient_name: "Test Person",
  notes: "Some notes",
  points: "One\nTwo",
  ...extra,
});

beforeAll(async () => {
  f = await createFixture();
});
afterAll(() => f.cleanup());

async function issue(member: string) {
  const result = await issueCertificate({
    prisma: f.prisma,
    adminId: f.adminId,
    templateId: f.templateId,
    rawValues: raw(member),
    confirmDuplicate: false,
    renderPdf: okRender,
  });
  if (result.status !== "issued") throw new Error(`expected issued, got ${result.status}`);
  return result.id;
}

const load = (id: string) => f.prisma.certificate.findUniqueOrThrow({ where: { id } });
const trail = (id: string) =>
  f.prisma.certificateAudit.findMany({ where: { certificateId: id }, orderBy: { id: "asc" } });

async function edit(
  id: string,
  values: Record<string, string>,
  extra: Partial<Parameters<typeof editCertificate>[0]> = {},
) {
  const current = await load(id);
  return editCertificate({
    prisma: f.prisma,
    adminId: f.adminId,
    certificateId: id,
    rawValues: values,
    reason: "Fix a typo",
    loadedUpdatedAt: current.updatedAt.toISOString(),
    confirmDuplicate: false,
    renderPdf: okRender,
    ...extra,
  });
}

describe("edit, revoke and restore leave a complete audit trail", () => {
  it("records created → edited → revoked → restored, keeps the template version, deletes nothing", async () => {
    const member = `T1-${f.suffix}`;
    const id = await issue(member);
    const original = await load(id);

    expect((await edit(id, raw(member, { recipient_name: "Corrected Person" }))).status).toBe(
      "changed",
    );
    const revokedResult = await revokeCertificate({
      prisma: f.prisma,
      adminId: f.adminId,
      certificateId: id,
      reason: "Issued in error",
    });
    expect(revokedResult.status).toBe("changed");
    const revoked = await load(id);
    expect(revoked.status).toBe("revoked");
    expect(revoked.revokedAt).toBeInstanceOf(Date);
    expect(revoked.revocationReason).toBe("Issued in error");

    const restoredResult = await restoreCertificate({
      prisma: f.prisma,
      adminId: f.adminId,
      certificateId: id,
      reason: "Revoked by mistake",
    });
    expect(restoredResult.status).toBe("changed");
    const restored = await load(id);
    expect(restored.status).toBe("active");
    expect(restored.revokedAt).toBeNull();
    expect(restored.revocationReason).toBeNull();

    // Exactly one audit row per change, in order, each attributed to the admin.
    const rows = await trail(id);
    expect(rows.map((r) => r.action)).toEqual(["created", "edited", "revoked", "restored"]);
    expect(rows.every((r) => r.adminUserId === f.adminId)).toBe(true);
    expect(rows.map((r) => r.reason)).toEqual([
      null,
      "Fix a typo",
      "Issued in error",
      "Revoked by mistake",
    ]);
    expect(rows[1]!.oldData).toMatchObject({ recipient_name: "Test Person" });
    expect(rows[1]!.newData).toMatchObject({ recipient_name: "Corrected Person" });
    expect(rows[2]!.oldData).toBeNull();
    expect(rows[2]!.newData).toBeNull();

    // Pinned to the original template version, and the row still exists (never deleted).
    expect(restored.templateVersionId).toBe(original.templateVersionId);
    expect(restored.issuedAt.getTime()).toBe(original.issuedAt.getTime());
    expect(await f.prisma.certificate.count({ where: { id } })).toBe(1);
  });
});

describe("editCertificate refusals write nothing", () => {
  const untouched = async (id: string, auditRows: number, data: unknown) => {
    expect(await trail(id)).toHaveLength(auditRows);
    expect((await load(id)).data).toEqual(data);
  };

  it("requires a reason and valid fields", async () => {
    const id = await issue(`T2-${f.suffix}`);
    const before = (await load(id)).data;
    expect(
      await edit(id, raw(`T2-${f.suffix}`, { recipient_name: "X" }), { reason: "   " }),
    ).toMatchObject({
      status: "invalid",
      errors: { reason: "A reason is required" },
    });
    expect(await edit(id, raw("", { recipient_name: "X" }))).toMatchObject({
      status: "invalid",
      errors: { member_id: "Member ID is required" },
    });
    expect(
      await edit(id, raw(`T2-${f.suffix}`, { recipient_name: "X" }), { reason: "r".repeat(501) }),
    ).toMatchObject({ status: "invalid" });
    await untouched(id, 1, before);
  });

  it("refuses an edit that changes nothing", async () => {
    const member = `T3-${f.suffix}`;
    const id = await issue(member);
    expect((await edit(id, raw(member))).status).toBe("no_changes");
    await untouched(id, 1, (await load(id)).data);
  });

  it("refuses to edit a revoked certificate", async () => {
    const member = `T4-${f.suffix}`;
    const id = await issue(member);
    await revokeCertificate({
      prisma: f.prisma,
      adminId: f.adminId,
      certificateId: id,
      reason: "why",
    });
    expect(await edit(id, raw(member, { recipient_name: "Changed" }))).toMatchObject({
      status: "wrong_state",
    });
    expect(await trail(id)).toHaveLength(2);
  });

  it("refuses an edit that would not fit on one page", async () => {
    const member = `T5-${f.suffix}`;
    const id = await issue(member);
    const overflow = vi.fn(async () => {
      throw new PageOverflowError(
        "Certificate for X does not fit on one page. Shorten 'Points'.",
        "points",
      );
    });
    const result = await edit(id, raw(member, { points: "Many\nMore" }), {
      renderPdf: overflow as never,
    });
    expect(result).toMatchObject({ status: "overflow", field: "points" });
    await untouched(id, 1, (await load(id)).data);
  });

  it("detects a concurrent change (optimistic lock)", async () => {
    const member = `T6-${f.suffix}`;
    const id = await issue(member);
    const staleUpdatedAt = (await load(id)).updatedAt.toISOString();

    expect((await edit(id, raw(member, { recipient_name: "First editor" }))).status).toBe(
      "changed",
    );
    const second = await edit(id, raw(member, { recipient_name: "Second editor" }), {
      loadedUpdatedAt: staleUpdatedAt,
    });
    expect(second.status).toBe("conflict");
    expect((await load(id)).data).toMatchObject({ recipient_name: "First editor" });
    expect(await trail(id)).toHaveLength(2);
  });

  it("warns when an edit moves the certificate onto another one's key, and saves anyway on confirmation", async () => {
    const otherMember = `T7-${f.suffix}`;
    await issue(otherMember);
    const id = await issue(`T7B-${f.suffix}`);

    const warned = await edit(id, raw(otherMember));
    expect(warned.status).toBe("duplicate");
    expect(await trail(id)).toHaveLength(1);

    expect((await edit(id, raw(otherMember), { confirmDuplicate: true })).status).toBe("changed");
    expect(await trail(id)).toHaveLength(2);
  });
});

describe("revoke and restore refusals", () => {
  it("require a reason and refuse a repeat", async () => {
    const id = await issue(`T8-${f.suffix}`);
    const base = { prisma: f.prisma, adminId: f.adminId, certificateId: id };

    expect(await revokeCertificate({ ...base, reason: "" })).toMatchObject({ status: "invalid" });
    expect(await restoreCertificate({ ...base, reason: "not revoked yet" })).toMatchObject({
      status: "wrong_state",
    });
    expect((await revokeCertificate({ ...base, reason: "first" })).status).toBe("changed");
    expect(await revokeCertificate({ ...base, reason: "second" })).toMatchObject({
      status: "wrong_state",
    });
    expect(await trail(id)).toHaveLength(2); // created + the one revoke
  });

  it("report an unknown certificate", async () => {
    const base = {
      prisma: f.prisma,
      adminId: f.adminId,
      certificateId: "00000000-0000-4000-8000-000000000000",
    };
    expect((await revokeCertificate({ ...base, reason: "x" })).status).toBe("not_found");
    expect((await restoreCertificate({ ...base, reason: "x" })).status).toBe("not_found");
  });
});
