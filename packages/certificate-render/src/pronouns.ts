export const HONORIFICS = ["Mr.", "Ms.", "Mx."] as const;
export type Honorific = (typeof HONORIFICS)[number];

export interface DerivedPronouns {
  pronoun_subject: string;
  Pronoun_subject: string;
  pronoun_object: string;
  Pronoun_object: string;
  pronoun_possessive: string;
  Pronoun_possessive: string;
  /** True when verbs take the plural form (they are / they have). */
  pronoun_plural: boolean;
}

const FORMS: Record<
  Honorific,
  { subject: string; object: string; possessive: string; plural: boolean }
> = {
  "Mr.": { subject: "he", object: "him", possessive: "his", plural: false },
  "Ms.": { subject: "she", object: "her", possessive: "her", plural: false },
  "Mx.": { subject: "they", object: "them", possessive: "their", plural: true },
};

export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function isHonorific(value: unknown): value is Honorific {
  return typeof value === "string" && (HONORIFICS as readonly string[]).includes(value);
}

/** Pronouns are always derived from the honorific and never stored. */
export function derivePronouns(honorific: string): DerivedPronouns {
  if (!isHonorific(honorific)) {
    throw new Error(`Unknown honorific "${honorific}"; expected one of ${HONORIFICS.join(", ")}`);
  }
  const f = FORMS[honorific];
  return {
    pronoun_subject: f.subject,
    Pronoun_subject: capitalize(f.subject),
    pronoun_object: f.object,
    Pronoun_object: capitalize(f.object),
    pronoun_possessive: f.possessive,
    Pronoun_possessive: capitalize(f.possessive),
    pronoun_plural: f.plural,
  };
}
