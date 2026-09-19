export const FIELD_TYPES = ["text", "date", "select", "richtext", "list"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

interface FieldBase {
  /** Template variable name, e.g. `recipient_name`. */
  name: string;
  /** Label shown in the admin form and used to match spreadsheet columns. */
  label: string;
  required: boolean;
  /** Shown on the public verification summary. Defaults to false. */
  public_summary?: boolean;
  /** Part of the duplicate-detection key. Defaults to false. */
  dedupe?: boolean;
  /** Pre-fills the form and fills blank import cells (text, date and select fields only). */
  default?: string;
}

export interface TextField extends FieldBase {
  type: "text";
}

/** Stored as an ISO `YYYY-MM-DD` string. */
export interface DateField extends FieldBase {
  type: "date";
}

export interface SelectField extends FieldBase {
  type: "select";
  options: readonly [string, ...string[]];
}

/** Sanitized HTML string; sanitization happens on save, not here. */
export interface RichTextField extends FieldBase {
  type: "richtext";
}

/** Ordered array of bullet strings. */
export interface ListField extends FieldBase {
  type: "list";
}

export type FieldDefinition = TextField | DateField | SelectField | RichTextField | ListField;

export type FieldSchema = readonly FieldDefinition[];

export type FieldValue = string | string[];
export type CertificateData = Record<string, FieldValue>;

/** The shape of a template's `schema.json` / `template_versions.field_schema` wrapper. */
export interface TemplateSchemaFile {
  name: string;
  fields: FieldSchema;
}
