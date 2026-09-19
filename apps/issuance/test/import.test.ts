// Bulk import against the Aiven test database. Files are built here with fake people, in
// the same shape as the real pillar sheet (bullet cells, Gender column, blank trailing headers).
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import type { FieldSchema } from "@moraspirit/shared";
import { analyzeImport } from "../lib/import/analyze-import";
import { commitImport } from "../lib/import/commit-import";
import { PageOverflowError } from "../lib/pdf/render-pdf";
import { createFixture, type Fixture } from "./fixtures";

const schema: FieldSchema = [
  { name: "member_id", label: "Member ID", type: "text", required: true, dedupe: true },
  { name: "recipient_name", label: "Name", type: "text", required: true, public_summary: true },
  {
    name: "honorific",
    label: "Honorific",
    type: "select",
    required: true,
    options: ["Mr.", "Ms.", "Mx."],
  },
  { name: "pillar_name", label: "Pillar", type: "text", required: true },
  { name: "start_date", label: "Start date", type: "date", required: true },
  { name: "end_date", label: "End date", type: "date", required: true },
  { name: "general_points", label: "General Points", type: "list", required: true },
  { name: "special_points", label: "Special Points", type: "list", required: false },
  { name: "signatory_name", label: "Signatory name", type: "text", required: true, default: "Sig" },
];

const HEADER = [
  "Member ID",
  "Name",
  "Gender",
  "Pillar",
  "Start date",
  "End date",
  "General Points",
  "Special Points",
  "",
  "",
];
type Row = (string | Date | undefined)[];
const good = (id: string, over: Partial<Record<number, string>> = {}): Row => {
  const row: Row = [
    id,
    ` Person ${id} `,
    "Female",
    "Test Pillar",
    "01/02/2025",
    "2025-03-04",
    "• It’s one\n\n• Two “quoted”",
    "",
  ];
  for (const [i, v] of Object.entries(over)) row[Number(i)] = v;
  return row;
};

function xlsx(rows: Row[], header: string[] = HEADER, sheets = 1): Buffer {
  const wb = XLSX.utils.book_new();
  for (let i = 0; i < sheets; i++) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...rows]), `Sheet${i + 1}`);
  }
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

let fx: Fixture;
const okRender = vi.fn(async () => new Uint8Array([1]));

beforeAll(async () => {
  fx = await createFixture(schema);
});
afterAll(async () => {
  await fx.prisma.importBatch.deleteMany({ where: { templateVersionId: fx.versionId } });
  await fx.cleanup();
});

const base = () => ({ prisma: fx.prisma, templateId: fx.templateId, renderPdf: okRender });

describe("analyzeImport", () => {
  it("validates rows, trims cells and parses bullet cells with curly quotes intact", async () => {
    const result = await analyzeImport({
      ...base(),
      fileName: "a.xlsx",
      buffer: xlsx([good("T1"), good("T2", { 2: "Male", 7: "• Special\n\n• Two" })]),
    });
    if (result.status !== "ready") throw new Error(result.status);
    expect(result.rows.map((r) => r.errors)).toEqual([{}, {}]);
    const [first, second] = result.rows;
    expect(first!.data).toMatchObject({
      recipient_name: "Person T1",
      honorific: "Ms.",
      start_date: "2025-02-01",
      end_date: "2025-03-04",
      general_points: ["It’s one", "Two “quoted”"],
      signatory_name: "Sig",
    });
    expect(first!.data?.special_points).toEqual([]); // a General letter: empty list, section skipped
    expect(second!.data).toMatchObject({ honorific: "Mr.", special_points: ["Special", "Two"] });
  });

  it("reads real Excel date cells without a time-zone shift", async () => {
    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([HEADER, good("D1")]);
    sheet["E2"] = { t: "n", v: 45870, z: "yyyy-mm-dd" }; // 2025-08-01
    XLSX.utils.book_append_sheet(wb, sheet, "S");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const result = await analyzeImport({ ...base(), fileName: "d.xlsx", buffer });
    if (result.status !== "ready") throw new Error(result.status);
    expect(result.rows[0]!.data?.start_date).toBe("2025-08-01");
  });

  it("rejects a row with missing gender, a bad date or missing points, and says why", async () => {
    const result = await analyzeImport({
      ...base(),
      fileName: "a.xlsx",
      buffer: xlsx([
        good("E1", { 2: "" }),
        good("E2", { 4: "04/28/2025" }),
        good("E3", { 6: "" }),
        ["E4", "Only Name"],
      ]),
    });
    if (result.status !== "ready") throw new Error(result.status);
    const [a, b, c, d] = result.rows;
    expect(a!.errors.honorific).toBe("Gender is required");
    expect(b!.errors.start_date).toContain("DD/MM/YYYY");
    expect(c!.errors.general_points).toContain("required");
    expect(Object.keys(d!.errors)).toContain("honorific");
    expect(result.rows.every((r) => r.data === undefined)).toBe(true);
  });

  it("fails the upload when a required column is missing, naming it", async () => {
    const result = await analyzeImport({
      ...base(),
      fileName: "a.xlsx",
      buffer: xlsx([["T1", "P"]], ["Member ID", "Name", "Extra"]),
    });
    expect(result).toMatchObject({ status: "column_error", unknown: ["Extra"] });
    if (result.status !== "column_error") return;
    expect(result.missingRequired).toEqual(
      expect.arrayContaining(["Honorific", "Pillar", "Start date", "End date", "General Points"]),
    );
  });

  it("asks for a worksheet when the workbook has several", async () => {
    const buffer = xlsx([good("S1")], HEADER, 2);
    const first = await analyzeImport({ ...base(), fileName: "a.xlsx", buffer });
    expect(first).toEqual({ status: "choose_sheet", sheetNames: ["Sheet1", "Sheet2"] });
    const second = await analyzeImport({
      ...base(),
      fileName: "a.xlsx",
      buffer,
      sheetName: "Sheet2",
    });
    expect(second.status).toBe("ready");
  });

  it("reads a UTF-8 csv with a BOM and refuses a non-UTF-8 one", async () => {
    const bom = String.fromCharCode(0xfeff);
    const csv = `${bom}Member ID,Name,Gender,Pillar,Start date,End date,General Points\r\nC1," Csv Person ",Male,P,2025-01-01,2025-02-02,"• One\n\n• Two"\r\n`;
    const ok = await analyzeImport({
      ...base(),
      fileName: "a.csv",
      buffer: Buffer.from(csv, "utf8"),
    });
    if (ok.status !== "ready") throw new Error(ok.status);
    expect(ok.rows[0]!.data).toMatchObject({
      recipient_name: "Csv Person",
      general_points: ["One", "Two"],
    });

    const bad = await analyzeImport({
      ...base(),
      fileName: "a.csv",
      buffer: Buffer.from([0x4d, 0x65, 0x6d, 0x62, 0x65, 0x72, 0x0a, 0x92, 0x0a]),
    });
    expect(bad).toMatchObject({ status: "file_error" });
  });

  it("turns a page overflow into a row error naming the field", async () => {
    const overflow = vi.fn(async () => {
      throw new PageOverflowError("does not fit. Shorten 'General Points'.", "general_points");
    });
    const result = await analyzeImport({
      ...base(),
      renderPdf: overflow,
      fileName: "a.xlsx",
      buffer: xlsx([good("O1")]),
    });
    if (result.status !== "ready") throw new Error(result.status);
    expect(result.rows[0]!.errors.general_points).toContain("Shorten");
    expect(result.rows[0]!.data).toBeUndefined();
  });

  it("flags a repeated row in the same file as a duplicate of the earlier one", async () => {
    const result = await analyzeImport({
      ...base(),
      fileName: "a.xlsx",
      buffer: xlsx([good("R1"), good("R1")]),
    });
    if (result.status !== "ready") throw new Error(result.status);
    expect(result.rows[0]!.duplicate).toBeUndefined();
    expect(result.rows[1]!.duplicate).toMatchObject({ earlierRow: 2 });
  });
});

describe("commitImport", () => {
  const commit = (rows: Row[], extra: Partial<Parameters<typeof commitImport>[0]> = {}) =>
    commitImport({
      ...base(),
      adminId: fx.adminId,
      fileName: "batch.xlsx",
      buffer: xlsx(rows),
      issueAnywayRows: [],
      skipInvalid: false,
      confirmDuplicateFile: false,
      ...extra,
    });

  it("is blocked by invalid rows and writes nothing, unless they are skipped", async () => {
    const rows = [good("K1"), good("K2", { 2: "" })];
    const blocked = await commit(rows);
    expect(blocked.status).toBe("blocked");
    expect(await fx.prisma.importBatch.count({ where: { templateVersionId: fx.versionId } })).toBe(
      0,
    );

    const done = await commit(rows, { skipInvalid: true });
    expect(done).toMatchObject({ status: "committed", inserted: 1, skipped: 0, rejected: 1 });
  });

  it("writes the batch, its certificates and one created audit row each", async () => {
    const done = await commit([good("B1"), good("B2", { 7: "• S1" })], {
      // The identical file above was already imported; this one differs.
    });
    if (done.status !== "committed") throw new Error(JSON.stringify(done));
    const batch = await fx.prisma.importBatch.findUniqueOrThrow({ where: { id: done.batchId } });
    expect(batch).toMatchObject({
      rowCount: 2,
      insertedCount: 2,
      skippedCount: 0,
      rejectedCount: 0,
      fileType: "xlsx",
      sheetName: "Sheet1",
    });
    const certs = await fx.prisma.certificate.findMany({ where: { importBatchId: batch.id } });
    expect(certs).toHaveLength(2);
    for (const cert of certs) {
      const audit = await fx.prisma.certificateAudit.findMany({
        where: { certificateId: cert.id },
      });
      expect(audit.map((a) => a.action)).toEqual(["created"]);
      expect(cert.templateVersionId).toBe(fx.versionId);
    }
  });

  it("warns about a re-uploaded file and skips flagged rows unless issued anyway", async () => {
    const rows = [good("U1"), good("U2")];
    expect((await commit(rows)).status).toBe("committed");

    const again = await analyzeImport({ ...base(), fileName: "batch.xlsx", buffer: xlsx(rows) });
    if (again.status !== "ready") throw new Error(again.status);
    expect(again.fileDuplicate).toMatchObject({ insertedCount: 2 });
    expect(again.rows.every((r) => r.duplicate?.existing.length === 1)).toBe(true);

    expect((await commit(rows)).status).toBe("blocked"); // file already imported
    const skipped = await commit([...rows, good("U3")], { confirmDuplicateFile: true });
    expect(skipped).toMatchObject({ status: "committed", inserted: 1, skipped: 2 });

    const anyway = await commit(rows, { confirmDuplicateFile: true, issueAnywayRows: [2] });
    expect(anyway).toMatchObject({ status: "committed", inserted: 1, skipped: 1 });
  });

  it("refuses when nothing is left to import", async () => {
    const result = await commit([good("N1", { 2: "" })], { skipInvalid: true });
    expect(result.status).toBe("blocked");
  });
});
