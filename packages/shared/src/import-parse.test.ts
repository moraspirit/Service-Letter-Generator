import { describe, expect, it } from "vitest";
import type { FieldSchema } from "./field-schema";
import {
  convertRow,
  genderToHonorific,
  mapColumns,
  normalizeDateText,
  normalizeHeader,
} from "./import-parse";

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
  { name: "signatory", label: "Signatory", type: "text", required: true, default: "Someone" },
];

const headers = ["Member ID", " NAME ", "gender", "start_date", "General  Points", "", "Extra"];

describe("mapColumns", () => {
  it("matches labels and names ignoring case, spacing and underscores", () => {
    expect(normalizeHeader(" Start_Date ")).toBe("start date");
    const m = mapColumns(schema, headers);
    expect(m.columns.map((c) => c.target)).toEqual([
      "member_id",
      "recipient_name",
      "gender",
      "start_date",
      "points",
    ]);
  });

  it("reports unknown columns, ignores empty headers and lets defaults cover required fields", () => {
    const m = mapColumns(schema, headers);
    expect(m.unknown).toEqual(["Extra"]);
    expect(m.missingRequired).toEqual([]);
  });

  it("names the required columns that are missing", () => {
    expect(mapColumns(schema, ["Member ID", "Name"]).missingRequired).toEqual([
      "Honorific",
      "Start date",
      "General Points",
    ]);
  });

  it("accepts a Gender column in place of Honorific", () => {
    expect(mapColumns(schema, ["Gender"]).missingRequired).not.toContain("Honorific");
  });
});

describe("genderToHonorific", () => {
  it("maps Male and Female only", () => {
    expect(genderToHonorific(" male ")).toBe("Mr.");
    expect(genderToHonorific("FEMALE")).toBe("Ms.");
    expect(genderToHonorific("Other")).toBeNull();
    expect(genderToHonorific("")).toBeNull();
  });
});

describe("normalizeDateText", () => {
  it("accepts ISO and DD/MM/YYYY", () => {
    expect(normalizeDateText("2025-04-28")).toBe("2025-04-28");
    expect(normalizeDateText("28/04/2025")).toBe("2025-04-28");
    expect(normalizeDateText("1/2/2025")).toBe("2025-02-01");
  });

  it("rejects everything else", () => {
    for (const bad of [
      "04/28/2025",
      "2025-13-01",
      "31/02/2025",
      "28 April 2025",
      "",
      "2025/04/28",
    ]) {
      expect(normalizeDateText(bad)).toBeNull();
    }
  });
});

describe("convertRow", () => {
  const mapping = mapColumns(schema, headers);
  const row = (over: Record<number, string> = {}) => {
    const cells = ["SPL1", " Test Person ", "Female", "28/04/2025", "• a\n\n• b", "", ""];
    for (const [i, v] of Object.entries(over)) cells[Number(i)] = v;
    return convertRow(schema, mapping, cells);
  };

  it("trims, maps gender and normalizes dates", () => {
    const { raw, errors } = row();
    expect(errors).toEqual({});
    expect(raw).toMatchObject({
      member_id: "SPL1",
      recipient_name: "Test Person",
      honorific: "Ms.",
      start_date: "2025-04-28",
      points: "• a\n\n• b",
    });
  });

  it("fails an unknown or blank gender and a bad date", () => {
    expect(row({ 2: "" }).errors.honorific).toBe("Gender is required");
    expect(row({ 2: "x" }).errors.honorific).toContain("not Male or Female");
    expect(row({ 3: "04/28/2025" }).errors.start_date).toContain("DD/MM/YYYY");
  });
});
