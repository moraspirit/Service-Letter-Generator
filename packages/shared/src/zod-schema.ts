import { z } from "zod";
import type { FieldDefinition, FieldSchema } from "./field-schema";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function fieldValidator(field: FieldDefinition): z.ZodType<string | string[]> {
  switch (field.type) {
    case "text":
    case "richtext":
      return z
        .string()
        .trim()
        .min(field.required ? 1 : 0, `${field.label} is required`);
    case "date":
      return z
        .string()
        .trim()
        .refine(isRealDate, {
          message: `${field.label} must be a valid date (YYYY-MM-DD)`,
        });
    case "select":
      return z
        .string()
        .trim()
        .refine((v) => (field.options as readonly string[]).includes(v), {
          message: `${field.label} must be one of: ${field.options.join(", ")}`,
        });
    case "list": {
      const item = z.string().trim().min(1);
      return field.required
        ? z.array(item).min(1, `${field.label} needs at least one item`)
        : z.array(item);
    }
  }
}

/**
 * Builds the object validator for a template's field schema. Optional fields may
 * be omitted; unknown keys are rejected so stray data never reaches `certificates.data`.
 */
export function buildZodSchema(schema: FieldSchema) {
  const shape: Record<string, z.ZodType> = {};
  for (const field of schema) {
    const validator = fieldValidator(field);
    shape[field.name] = field.required ? validator : validator.optional();
  }
  return z.object(shape).strict();
}
