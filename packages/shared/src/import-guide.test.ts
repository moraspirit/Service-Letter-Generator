import { describe, expect, it } from "vitest";
import type { FieldSchema } from "./field-schema";
import { buildImportGuide, guideExampleRow } from "./import-guide";
import { convertRow, mapColumns } from "./import-parse";

const schema: FieldSchema = [
  { name: "member_id", label: "Member ID", type: "text", required: true, dedupe: true },
  { name: "recipient_name", label: "Name", type: "text", required: true },
  {
    name: "honorific",
    label: "Honorific",
    type: "select",
    required: true,
    options: ["Mr.", "Ms.", "Mx."],
  },
  { name: "start_date", label: "Start date", type: "date", required: true },
  { name: "points", label: "General Points", type: "list", required: true },
  { name: "extra", label: "Special Points", type: "list", required: false },
  { name: "signatory", label: "Signatory", type: "text", required: true, default: "Someone" },
];

describe("buildImportGuide", () => {
  const guide = buildImportGuide(schema);

  it("has one column per field, with Gender standing in for the honorific", () => {
    expect(guide.map((c) => c.heading)).toEqual([
      "Member ID",
      "Name",
      "Gender",
      "Start date",
      "General Points",
      "Special Points",
      "Signatory",
    ]);
  });

  it("separates required, optional and auto-filled columns", () => {
    const by = Object.fromEntries(guide.map((c) => [c.heading, c]));
    expect(by["Member ID"]).toMatchObject({ required: true, autoFilled: false });
    expect(by["Special Points"]).toMatchObject({ required: false, autoFilled: false });
    expect(by["Signatory"]).toMatchObject({ required: false, autoFilled: true });
    expect(by["Signatory"].description).toContain('"Someone"');
  });

  it("produces headings the importer maps with nothing missing or unknown", () => {
    const mapping = mapColumns(
      schema,
      guide.map((c) => c.heading),
    );
    expect(mapping.missingRequired).toEqual([]);
    expect(mapping.unknown).toEqual([]);
    expect(mapping.duplicated).toEqual([]);
  });
});

describe("guideExampleRow", () => {
  const sample = {
    member_id: "SAMPLE001",
    recipient_name: "Alex Example",
    honorific: "Ms.",
    start_date: "2025-04-28",
    points: ["First point.", "Second point."],
    signatory: "Someone",
  };
  const row = guideExampleRow(schema, sample);

  it("marks the member id so the row cannot be mistaken for real data", () => {
    expect(row[0]).toBe("EXAMPLE-DELETE-THIS-ROW");
  });

  it("writes Gender and bullets the way the importer reads them", () => {
    expect(row[2]).toBe("Female");
    expect(row[4]).toBe("• First point.\n• Second point.");
    expect(row[5]).toBe("");
  });

  it("converts cleanly through the real row importer", () => {
    const mapping = mapColumns(
      schema,
      buildImportGuide(schema).map((c) => c.heading),
    );
    const { raw, errors } = convertRow(schema, mapping, row);
    expect(errors).toEqual({});
    expect(raw.honorific).toBe("Ms.");
    expect(raw.start_date).toBe("2025-04-28");
  });
});
