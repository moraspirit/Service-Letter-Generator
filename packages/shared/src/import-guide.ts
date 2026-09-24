// What a spreadsheet must contain to import against a template. Built from the field
// schema alone, so the on-screen guide, the downloadable blank workbook and the importer
// (`mapColumns`) cannot disagree about a heading.
import type { FieldDefinition, FieldSchema } from "./field-schema";
import type { CertificateData } from "./field-schema";

export interface GuideColumn {
  /** The heading to put in row 1. The importer matches it ignoring case and spacing. */
  heading: string;
  /** A blank cell fails the row. False for optional fields and for ones a default covers. */
  required: boolean;
  /** Required by the template, but a blank cell is filled from the schema default. */
  autoFilled: boolean;
  /** How to fill the cell in. */
  description: string;
}

const HONORIFIC_FIELD = "honorific";
const GENDER_HEADING = "Gender";

function describe(field: FieldDefinition): string {
  switch (field.type) {
    case "text":
      return "Text.";
    case "date":
      return "A date: a real Excel date, or text as YYYY-MM-DD or DD/MM/YYYY.";
    case "select":
      return `One of: ${field.options.join(", ")}.`;
    case "richtext":
      return "Text. A blank line starts a new paragraph.";
    case "list":
      return "One bullet per line inside the cell (Alt+Enter in Excel). A leading • or - is removed.";
  }
}

export function buildImportGuide(schema: FieldSchema): GuideColumn[] {
  return schema.map((field) => {
    const autoFilled = field.required && field.default !== undefined;
    const base = {
      required: field.required && !autoFilled,
      autoFilled,
    };
    if (field.name === HONORIFIC_FIELD && field.type === "select") {
      return {
        ...base,
        heading: GENDER_HEADING,
        description:
          "Male or Female. The letter's Mr. or Ms. and its pronouns follow from this. For Mx., use a column headed Honorific with Mr., Ms. or Mx. instead.",
      };
    }
    const fill = autoFilled ? ` Left blank, it becomes "${field.default}".` : "";
    return { ...base, heading: field.label, description: describe(field) + fill };
  });
}

/** Sample values written as cell text, in schema order, matching `buildImportGuide`. */
export function guideExampleRow(schema: FieldSchema, sample: CertificateData): string[] {
  return schema.map((field) => {
    if (field.dedupe && field.type === "text") return "EXAMPLE-DELETE-THIS-ROW";
    const value = sample[field.name];
    if (field.name === HONORIFIC_FIELD && field.type === "select") {
      return value === "Mr." ? "Male" : "Female";
    }
    if (Array.isArray(value)) return value.map((line) => `• ${line}`).join("\n");
    return value ?? "";
  });
}
