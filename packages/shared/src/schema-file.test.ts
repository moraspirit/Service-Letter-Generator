import { describe, expect, it } from "vitest";
import { applyDefaults, parseTemplateSchemaFile } from "./schema-file";

const ok = {
  name: "T",
  fields: [
    { name: "a", label: "A", type: "text", required: true, default: "x" },
    { name: "b", label: "B", type: "list", required: false },
  ],
};

describe("parseTemplateSchemaFile", () => {
  it("accepts a valid file", () => {
    expect(parseTemplateSchemaFile(ok).fields).toHaveLength(2);
  });

  it("rejects duplicates, unknown types, bad names, unknown keys and list defaults", () => {
    const dup = { ...ok, fields: [ok.fields[0], ok.fields[0]] };
    expect(() => parseTemplateSchemaFile(dup)).toThrow(/duplicate/);
    expect(() =>
      parseTemplateSchemaFile({ ...ok, fields: [{ ...ok.fields[0], type: "number" }] }),
    ).toThrow();
    expect(() =>
      parseTemplateSchemaFile({ ...ok, fields: [{ ...ok.fields[0], name: "Bad Name" }] }),
    ).toThrow();
    expect(() =>
      parseTemplateSchemaFile({ ...ok, fields: [{ ...ok.fields[0], extra: 1 }] }),
    ).toThrow();
    expect(() =>
      parseTemplateSchemaFile({ ...ok, fields: [{ ...ok.fields[1], default: "x" }] }),
    ).toThrow(/cannot have a default/);
  });

  it("requires options on select fields", () => {
    const bad = { ...ok, fields: [{ name: "s", label: "S", type: "select", required: true }] };
    expect(() => parseTemplateSchemaFile(bad)).toThrow();
  });
});

describe("applyDefaults", () => {
  const { fields } = parseTemplateSchemaFile(ok);
  it("fills missing and blank values but keeps supplied ones", () => {
    expect(applyDefaults(fields, {}).a).toBe("x");
    expect(applyDefaults(fields, { a: "  " }).a).toBe("x");
    expect(applyDefaults(fields, { a: "y" }).a).toBe("y");
  });
});

describe("sampleDataFromSchema", () => {
  it("produces data that passes the schema's own validation", async () => {
    const { sampleDataFromSchema } = await import("./schema-file");
    const { buildZodSchema } = await import("./zod-schema");
    const { fields } = parseTemplateSchemaFile({
      name: "T",
      fields: [
        { name: "a", label: "A", type: "text", required: true },
        { name: "d", label: "D", type: "date", required: true },
        { name: "s", label: "S", type: "select", required: true, options: ["x", "y"] },
        { name: "l", label: "L", type: "list", required: true },
        { name: "r", label: "R", type: "richtext", required: false },
      ],
    });
    expect(buildZodSchema(fields).safeParse(sampleDataFromSchema(fields)).success).toBe(true);
  });
});
