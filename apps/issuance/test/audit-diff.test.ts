import { describe, expect, it } from "vitest";
import type { FieldSchema } from "@moraspirit/shared";
import { describeChanges } from "../lib/audit-diff";

const schema: FieldSchema = [
  { name: "name", label: "Name", type: "text", required: true },
  { name: "notes", label: "Notes", type: "richtext", required: false },
  { name: "points", label: "Points", type: "list", required: true },
];

describe("describeChanges", () => {
  it("lists only changed fields, with labels, in schema order", () => {
    expect(
      describeChanges(
        schema,
        { name: "Old", notes: "<p>a &amp; b</p>", points: ["x", "y"] },
        { name: "New", notes: "<p>a &amp; b</p>", points: ["x", "z"] },
      ),
    ).toEqual([
      { label: "Name", before: "Old", after: "New" },
      { label: "Points", before: "• x\n• y", after: "• x\n• z" },
    ]);
  });

  it("shows added and removed values as (empty)", () => {
    expect(
      describeChanges(
        schema,
        { name: "A", points: ["p"] },
        { name: "A", notes: "<p>n</p>", points: ["p"] },
      ),
    ).toEqual([{ label: "Notes", before: "(empty)", after: "n" }]);
  });

  it("returns nothing for actions without data", () => {
    expect(describeChanges(schema, null, null)).toEqual([]);
  });
});
