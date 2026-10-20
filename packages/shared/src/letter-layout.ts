// Spacing for a service letter. The numbers are data: a template holds the
// starting values for new letters, and each certificate stores its own copy.
// The renderer turns a validated layout into CSS. Raw admin text never reaches
// the stylesheet.

export const LETTER_LAYOUT_FIELDS = [
  {
    key: "fontSizePt",
    label: "Font size",
    unit: "pt",
    min: 9,
    max: 14,
    step: 0.5,
    fallback: 12,
  },
  {
    key: "topIn",
    label: "Gap under the letterhead",
    unit: "in",
    min: 1.2,
    max: 2.4,
    step: 0.05,
    fallback: 1.7,
  },
  {
    key: "bottomIn",
    label: "Gap above the footer",
    unit: "in",
    min: 0.85,
    max: 2,
    step: 0.05,
    fallback: 1.25,
  },
  {
    key: "sideIn",
    label: "Side inset",
    unit: "in",
    min: 0.6,
    max: 1.5,
    step: 0.05,
    fallback: 1,
  },
  {
    key: "lineHeight",
    label: "Line spacing",
    unit: "",
    min: 1,
    max: 1.5,
    step: 0.05,
    fallback: 1.15,
  },
  {
    key: "paragraphEm",
    label: "Space between paragraphs",
    unit: "em",
    min: 0.2,
    max: 1.6,
    step: 0.05,
    fallback: 0.8,
  },
  {
    key: "bulletEm",
    label: "Space between bullets",
    unit: "em",
    min: 0,
    max: 1.2,
    step: 0.05,
    fallback: 0.5,
  },
  {
    key: "bulletIndentIn",
    label: "Bullet indent",
    unit: "in",
    min: 0.2,
    max: 0.8,
    step: 0.05,
    fallback: 0.45,
  },
] as const;

export type LetterLayoutKey = (typeof LETTER_LAYOUT_FIELDS)[number]["key"];

export type LetterLayout = Record<LetterLayoutKey, number>;

export const LETTER_LAYOUT_DEFAULTS: LetterLayout = {
  fontSizePt: 12,
  topIn: 1.7,
  bottomIn: 1.25,
  sideIn: 1,
  lineHeight: 1.15,
  paragraphEm: 0.8,
  bulletEm: 0.5,
  bulletIndentIn: 0.45,
};

/** Form field name. Prefixed so it cannot collide with a template variable. */
export function spacingInputName(key: LetterLayoutKey): string {
  return `spacing_${key}`;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** A decimal with no exponent and no unit. Only this function writes a number into CSS. */
export function formatLayoutNumber(value: number): string {
  const rounded = round3(value);
  if (!Number.isFinite(rounded)) throw new Error("Invalid layout number");
  return String(rounded);
}

export function layoutFieldText(key: LetterLayoutKey, value: number): string {
  const field = LETTER_LAYOUT_FIELDS.find((item) => item.key === key);
  const number = formatLayoutNumber(value);
  return field?.unit ? `${number} ${field.unit}` : number;
}

function inRange(key: LetterLayoutKey, value: number): boolean {
  const field = LETTER_LAYOUT_FIELDS.find((item) => item.key === key);
  return field !== undefined && Number.isFinite(value) && value >= field.min && value <= field.max;
}

/**
 * CSS that overrides the template's spacing. Selectors match the letter templates,
 * and the numbers are produced here, so a saved layout cannot inject CSS.
 */
export function letterLayoutCss(layout: LetterLayout): string {
  const side = formatLayoutNumber(layout.sideIn);
  const paragraph = formatLayoutNumber(layout.paragraphEm);
  return [
    `.page { font-size: ${formatLayoutNumber(layout.fontSizePt)}pt; line-height: ${formatLayoutNumber(layout.lineHeight)}; }`,
    `#letter-body { left: ${side}in; right: ${side}in; top: ${formatLayoutNumber(layout.topIn)}in; bottom: ${formatLayoutNumber(layout.bottomIn)}in; }`,
    `#letter-body p { margin: 0 0 ${paragraph}em; }`,
    `#letter-body ul { margin: 0 0 ${paragraph}em; padding-left: ${formatLayoutNumber(layout.bulletIndentIn)}in; }`,
    `#letter-body li { margin: 0 0 ${formatLayoutNumber(layout.bulletEm)}em; }`,
  ].join("\n");
}

/** A layout read from JSON. Anything incomplete or out of range is rejected. */
export function parseStoredLayout(value: unknown): LetterLayout | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const layout = {} as LetterLayout;
  for (const field of LETTER_LAYOUT_FIELDS) {
    const raw = record[field.key];
    // Letters saved before font size was editable omit it. Keep their spacing
    // and use the built-in 12pt rather than throwing the snapshot away.
    if (raw === undefined && field.key === "fontSizePt") {
      layout.fontSizePt = LETTER_LAYOUT_DEFAULTS.fontSizePt;
      continue;
    }
    const number = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
    if (!inRange(field.key, number)) return null;
    layout[field.key] = round3(number);
  }
  return layout;
}

/** The spacing a certificate actually renders with. A missing snapshot is the built-in spacing. */
export function effectiveLayout(stored: unknown): LetterLayout {
  return parseStoredLayout(stored) ?? { ...LETTER_LAYOUT_DEFAULTS };
}

export function layoutEquals(a: LetterLayout, b: LetterLayout): boolean {
  return LETTER_LAYOUT_FIELDS.every((field) => a[field.key] === b[field.key]);
}

export type LayoutParseResult =
  { ok: true; layout: LetterLayout | null } | { ok: false; errors: Record<string, string> };

/**
 * Reads spacing inputs. When none of the inputs were submitted, `layout` is null
 * (the caller keeps the template default or the letter's saved spacing). When any
 * input is present, every measurement must be inside its range.
 */
export function letterLayoutFromRaw(raw: Record<string, string | undefined>): LayoutParseResult {
  const submitted = LETTER_LAYOUT_FIELDS.some(
    (field) => raw[spacingInputName(field.key)] !== undefined,
  );
  if (!submitted) return { ok: true, layout: null };

  const errors: Record<string, string> = {};
  const layout = {} as LetterLayout;
  for (const field of LETTER_LAYOUT_FIELDS) {
    const name = spacingInputName(field.key);
    const text = (raw[name] ?? "").trim();
    const number = Number(text);
    if (text === "" || !inRange(field.key, number)) {
      const unit = field.unit ? ` ${field.unit}` : "";
      errors[name] = `${field.label} must be between ${field.min} and ${field.max}${unit}`;
    } else {
      layout[field.key] = round3(number);
    }
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, layout };
}
