import { describe, expect, it } from "vitest";
import type { FieldSchema } from "./field-schema";
import { buildZodSchema } from "./zod-schema";

const schema: FieldSchema = [
  { name: "member_id", label: "Member ID", type: "text", required: true, dedupe: true },
  {
    name: "honorific",
    label: "Honorific",
    type: "select",
    required: true,
    options: ["Mr.", "Ms.", "Mx."],
  },
  { name: "start_date", label: "Start date", type: "date", required: true, public_summary: true },
  { name: "general_points", label: "General points", type: "list", required: true },
  { name: "special_points", label: "Special points", type: "list", required: false },
];

const valid = {
  member_id: " X1 ",
  honorific: "Ms.",
  start_date: "2025-04-28",
  general_points: ["a"],
};

describe("buildZodSchema", () => {
  const zs = buildZodSchema(schema);

  it("accepts valid data, trims text and allows omitted optional fields", () => {
    const r = zs.safeParse(valid);
    expect(r.success).toBe(true);
    expect(r.data?.member_id).toBe("X1");
  });

  it("rejects missing or blank required fields", () => {
    expect(zs.safeParse({ ...valid, member_id: "  " }).success).toBe(false);
    expect(zs.safeParse({ ...valid, general_points: [] }).success).toBe(false);
    const rest: Record<string, unknown> = { ...valid };
    delete rest.honorific;
    expect(zs.safeParse(rest).success).toBe(false);
  });

  it("rejects values outside the select options", () => {
    expect(zs.safeParse({ ...valid, honorific: "Dr." }).success).toBe(false);
  });

  it("rejects malformed and impossible dates", () => {
    expect(zs.safeParse({ ...valid, start_date: "28/04/2025" }).success).toBe(false);
    expect(zs.safeParse({ ...valid, start_date: "2025-02-30" }).success).toBe(false);
  });

  it("accepts an optional list and rejects blank items in it", () => {
    expect(zs.safeParse({ ...valid, special_points: ["x"] }).success).toBe(true);
    expect(zs.safeParse({ ...valid, special_points: [""] }).success).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(zs.safeParse({ ...valid, extra: "x" }).success).toBe(false);
  });
});
