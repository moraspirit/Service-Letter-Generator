import { describe, expect, it } from "vitest";
import {
  LETTER_LAYOUT_DEFAULTS,
  effectiveLayout,
  letterLayoutCss,
  letterLayoutFromRaw,
  parseStoredLayout,
  spacingInputName,
} from "./letter-layout";

const raw = (overrides: Record<string, string> = {}) =>
  Object.fromEntries(
    Object.entries(LETTER_LAYOUT_DEFAULTS).map(([key, value]) => [
      spacingInputName(key as keyof typeof LETTER_LAYOUT_DEFAULTS),
      overrides[key] ?? String(value),
    ]),
  );

describe("letter layout", () => {
  it("treats a missing snapshot as the built-in spacing", () => {
    expect(effectiveLayout(null)).toEqual(LETTER_LAYOUT_DEFAULTS);
    expect(parseStoredLayout({ topIn: 1.5 })).toBeNull();
  });

  it("accepts a complete in-range submission and rejects a value outside its range", () => {
    expect(letterLayoutFromRaw({})).toEqual({ ok: true, layout: null });
    const ok = letterLayoutFromRaw(raw({ topIn: "1.5" }));
    expect(ok).toMatchObject({ ok: true, layout: { topIn: 1.5, bottomIn: 1.25 } });
    const bad = letterLayoutFromRaw(raw({ topIn: "0.2" }));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors[spacingInputName("topIn")]).toMatch(/between 1.2 and 2.4/);
  });

  it("writes only numbers and fixed units into the stylesheet", () => {
    const css = letterLayoutCss({ ...LETTER_LAYOUT_DEFAULTS, topIn: 1.5, paragraphEm: 0.4 });
    expect(css).toContain("top: 1.5in;");
    expect(css).toContain("margin: 0 0 0.4em;");
    expect(css).not.toContain("red");
    const injected = letterLayoutFromRaw(raw({ lineHeight: "1.15; color: red" }));
    expect(injected.ok).toBe(false);
  });
});
