import { describe, expect, it } from "vitest";
import type { FieldSchema } from "@moraspirit/shared";
import { LETTER_LAYOUT_DEFAULTS } from "@moraspirit/shared";
import { describeChanges, describeLayoutChanges } from "../lib/audit-diff";

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

describe("describeLayoutChanges", () => {
  it("lists only the measurements that moved, treating a missing snapshot as the original spacing", () => {
    expect(describeLayoutChanges(null, null)).toEqual([]);
    expect(
      describeLayoutChanges(null, { ...LETTER_LAYOUT_DEFAULTS, topIn: 1.5, bulletEm: 0.2 }),
    ).toEqual([
      { label: "Gap under the letterhead", before: "1.7 in", after: "1.5 in" },
      { label: "Space between bullets", before: "0.5 em", after: "0.2 em" },
    ]);
  });
});
