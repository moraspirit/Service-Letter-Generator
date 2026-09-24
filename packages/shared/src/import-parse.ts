// Spreadsheet-import rules that do not depend on a file format: matching headers to a
// template's fields, mapping `Gender` to an honorific and normalizing text dates.
import type { FieldSchema } from "./field-schema";
import type { RawValues } from "./form-data";

/** Case-insensitive, whitespace-collapsed, underscores read as spaces: "Start_Date " == "start date". */
export function normalizeHeader(header: string): string {
  return header.replace(/_/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

/** The source sheets carry `Gender`; the schema's honorific field is what drives pronouns. */
const GENDER_HEADER = "gender";
const HONORIFIC_FIELD = "honorific";

export interface ColumnMapping {
  /** Header position -> schema field name (or `gender` for the Gender column). */
  columns: { index: number; header: string; target: string }[];
  /** Non-empty headers that match no field; reported and ignored. */
  unknown: string[];
  /** Required fields with neither a column nor a schema default. */
  missingRequired: string[];
  /** Headers that map to a field already mapped by an earlier column. */
  duplicated: string[];
}

export function mapColumns(schema: FieldSchema, headers: readonly string[]): ColumnMapping {
  const lookup = new Map<string, string>();
  for (const field of schema) {
    lookup.set(normalizeHeader(field.label), field.name);
    lookup.set(normalizeHeader(field.name), field.name);
  }
  const hasHonorific = schema.some((f) => f.name === HONORIFIC_FIELD && f.type === "select");
  if (hasHonorific) lookup.set(GENDER_HEADER, GENDER_HEADER);

  const columns: ColumnMapping["columns"] = [];
  const unknown: string[] = [];
  const duplicated: string[] = [];
  const seen = new Set<string>();
  headers.forEach((raw, index) => {
    const header = raw.trim();
    if (!header) return; // the sample workbook has ~20 empty header cells
    const target = lookup.get(normalizeHeader(header));
    if (!target) unknown.push(header);
    else if (seen.has(target)) duplicated.push(header);
    else {
      seen.add(target);
      columns.push({ index, header, target });
    }
  });

  const missingRequired = schema
    .filter((f) => {
      if (!f.required || f.default !== undefined) return false;
      if (seen.has(f.name)) return false;
      return !(f.name === HONORIFIC_FIELD && seen.has(GENDER_HEADER));
    })
    .map((f) => f.label);
  return { columns, unknown, missingRequired, duplicated };
}

/** `Male` -> `Mr.`, `Female` -> `Ms.` (case- and whitespace-insensitive); anything else fails. */
export function genderToHonorific(value: string): string | null {
  switch (value.trim().toLowerCase()) {
    case "male":
      return "Mr.";
    case "female":
      return "Ms.";
    default:
      return null;
  }
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DMY_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

function isRealDate(y: number, m: number, d: number): boolean {
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/**
 * Text dates are accepted only as ISO `YYYY-MM-DD` or `DD/MM/YYYY`. Anything else,
 * including US-style `MM/DD/YYYY` that happens to be ambiguous, is rejected rather than guessed.
 * Returns the ISO date or null.
 */
export function normalizeDateText(value: string): string | null {
  const text = value.trim();
  let y: number, m: number, d: number;
  const iso = ISO_DATE.exec(text);
  const dmy = DMY_DATE.exec(text);
  if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (dmy) [y, m, d] = [Number(dmy[3]), Number(dmy[2]), Number(dmy[1])];
  else return null;
  if (!isRealDate(y, m, d)) return null;
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export interface RowConversion {
  raw: RawValues;
  /** Problems found while converting (keyed by field name), before schema validation. */
  errors: Record<string, string>;
}

/**
 * Turns one spreadsheet row (already read as strings) into form-style raw values:
 * trims every cell, maps Gender, normalizes text dates. Blank cells are left out so a
 * schema `default` can fill them.
 */
export function convertRow(
  schema: FieldSchema,
  mapping: ColumnMapping,
  cells: readonly string[],
): RowConversion {
  const raw: RawValues = {};
  const errors: Record<string, string> = {};
  const fields = new Map(schema.map((f) => [f.name, f]));

  let genderCell: string | null = null;
  for (const { index, target } of mapping.columns) {
    const cell = (cells[index] ?? "").trim();
    if (target === GENDER_HEADER) {
      genderCell = cell;
      continue;
    }
    const field = fields.get(target);
    if (!field) continue;
    if (field.type === "date" && cell) {
      const iso = normalizeDateText(cell);
      if (iso) raw[target] = iso;
      else {
        // Keep the typed text so the admin can see what was wrong when fixing it by hand.
        raw[target] = cell;
        errors[target] = `${field.label} must be YYYY-MM-DD or DD/MM/YYYY`;
      }
      continue;
    }
    // Lists keep their inner line breaks; the list parser splits them later.
    raw[target] = cell;
  }

  // Gender only fills the honorific when the sheet has no Honorific value of its own.
  if (genderCell !== null && !raw[HONORIFIC_FIELD]) {
    const honorific = genderToHonorific(genderCell);
    if (honorific) raw[HONORIFIC_FIELD] = honorific;
    else
      errors[HONORIFIC_FIELD] = genderCell
        ? `Gender "${genderCell}" is not Male or Female`
        : "Gender is required";
  }
  return { raw, errors };
}
