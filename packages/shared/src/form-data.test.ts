import { describe, expect, it } from "vitest";
import type { FieldSchema } from "./field-schema";
import { dataFromRawValues, plainTextToRichText, validateCertificateData } from "./form-data";

const schema: FieldSchema = [
  { name: "member_id", label: "Member ID", type: "text", required: true },
  {
    name: "honorific",
    label: "Honorific",
    type: "select",
    required: true,
    options: ["Mr.", "Ms.", "Mx."],
  },
  { name: "start_date", label: "Start date", type: "date", required: true },
  { name: "intro", label: "Intro", type: "richtext", required: false },
  { name: "general_points", label: "General", type: "list", required: true },
  { name: "special_points", label: "Special", type: "list", required: false },
  { name: "signatory", label: "Signatory", type: "text", required: true, default: "A. Signer" },
];

const good = {
  member_id: " T1 ",
  honorific: "Ms.",
  start_date: "2025-04-28",
  general_points: "• One\n\n• Two",
};

describe("plainTextToRichText", () => {
  it("escapes everything, makes paragraphs of blank-line groups and <br> of single breaks", () => {
    expect(plainTextToRichText("a <b>x</b> & c\nnext\n\nsecond")).toBe(
      "<p>a &lt;b&gt;x&lt;/b&gt; &amp; c<br>next</p><p>second</p>",
    );
    expect(plainTextToRichText("  \n\n ")).toBe("");
  });
});

describe("dataFromRawValues", () => {
  it("trims, parses lists, omits blanks and applies defaults", () => {
    const data = dataFromRawValues(schema, good);
    expect(data).toEqual({
      member_id: "T1",
      honorific: "Ms.",
      start_date: "2025-04-28",
      general_points: ["One", "Two"],
      special_points: [],
      signatory: "A. Signer",
    });
  });

  it("ignores keys that are not in the schema", () => {
    expect("extra" in dataFromRawValues(schema, { ...good, extra: "x" })).toBe(false);
  });
});

describe("validateCertificateData", () => {
  it("accepts good data", () => {
    expect(validateCertificateData(schema, dataFromRawValues(schema, good)).ok).toBe(true);
  });

  it("reports required fields by label and format errors per field", () => {
    const result = validateCertificateData(
      schema,
      dataFromRawValues(schema, { honorific: "Dr.", start_date: "31/12/2025" }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.member_id).toBe("Member ID is required");
      expect(result.errors.general_points).toBe("General is required");
      expect(result.errors.honorific).toMatch(/must be one of/);
      expect(result.errors.start_date).toMatch(/valid date/);
    }
  });
});

describe("richTextToPlainText", () => {
  it("round-trips whatever plainTextToRichText produced", async () => {
    const { richTextToPlainText } = await import("./form-data");
    for (const text of [
      "one paragraph",
      "first\n\nsecond",
      "line one\nline two\n\nnew paragraph",
      "a <b>tag</b> & \"quotes\" and 'apostrophes'",
    ]) {
      expect(richTextToPlainText(plainTextToRichText(text))).toBe(text);
    }
  });

  it("drops other tags but keeps their text", async () => {
    const { richTextToPlainText } = await import("./form-data");
    expect(richTextToPlainText("<p>Hi <strong>you</strong></p>")).toBe("Hi you");
  });
});
