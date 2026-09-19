import { describe, expect, it } from "vitest";
import { parseListCell } from "./list-parser";

// Fixtures reproduce the exact structure of the pillar spreadsheet cells
// (U+2022 bullet + space, items separated by a blank line, occasional trailing
// newline, 1-3 items per cell) with synthetic wording, so no sample content is
// copied into the repository.
const B = "•";
const three = `${B} First item.\n\n${B} Second item.\n\n${B} Third item.`;
const twoTrailing = `${B} First item.\n\n${B} Second item.\n`;

describe("parseListCell", () => {
  it("splits a spreadsheet-style cell into ordered items", () => {
    expect(parseListCell(three)).toEqual(["First item.", "Second item.", "Third item."]);
  });

  it("ignores a trailing newline", () => {
    expect(parseListCell(twoTrailing)).toEqual(["First item.", "Second item."]);
  });

  it("handles a single-item cell", () => {
    expect(parseListCell(`${B} Only item.`)).toEqual(["Only item."]);
  });

  it.each([B, "-", "*", ""])("strips the %j marker", (marker) => {
    expect(parseListCell(`${marker} One\n${marker} Two`)).toEqual(["One", "Two"]);
  });

  it("handles CRLF and CR line breaks", () => {
    expect(parseListCell(`${B} A\r\n\r\n${B} B\r${B} C`)).toEqual(["A", "B", "C"]);
  });

  it("accepts plain lines from the manual-entry textarea", () => {
    expect(parseListCell("One\nTwo")).toEqual(["One", "Two"]);
  });

  it("keeps hyphens inside an item", () => {
    expect(parseListCell(`${B} Co-chaired the well-known event - twice`)).toEqual([
      "Co-chaired the well-known event - twice",
    ]);
  });

  it("returns [] for empty, whitespace-only and nullish input", () => {
    expect(parseListCell("")).toEqual([]);
    expect(parseListCell(" \n\n  ")).toEqual([]);
    expect(parseListCell(null)).toEqual([]);
    expect(parseListCell(undefined)).toEqual([]);
  });

  it("drops bullet-only lines", () => {
    expect(parseListCell(`${B}\n${B} Real\n-`)).toEqual(["Real"]);
  });
});
