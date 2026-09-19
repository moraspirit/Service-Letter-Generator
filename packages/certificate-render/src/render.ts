import Handlebars from "handlebars";
import type { CertificateData, FieldSchema } from "@moraspirit/shared";
import { resolveAssets, type AssetResolver } from "./assets";
import { formatDate } from "./format-date";
import { capitalize, derivePronouns } from "./pronouns";

/** The parts of a `template_versions` row that rendering needs. */
export interface RenderableTemplateVersion {
  html_content: string;
  field_schema: FieldSchema;
}

export interface RenderOptions {
  /** Rewrites `/certificate-assets/...` references, e.g. to data URIs for Puppeteer. */
  resolveAsset?: AssetResolver;
  /**
   * The verification QR code, exposed to templates as `{{verify_qr}}` (a data URI)
   * and `{{verify_url}}`. Omitted in previews, where the template shows a placeholder.
   */
  qr?: { dataUri: string; url: string };
}

// The one Handlebars instance. Helpers are registered here and nowhere else.
const hbs = Handlebars.create();

hbs.registerHelper("formatDate", (value: unknown) => {
  // Empty values render as nothing so a live preview of a half-filled form does not throw.
  if ((typeof value !== "string" && !(value instanceof Date)) || value === "") return "";
  return formatDate(value);
});

hbs.registerHelper("capitalize", (value: unknown) =>
  typeof value === "string" ? capitalize(value) : "",
);

// {{verb "is" "are"}}: singular/plural agreement driven by the honorific.
hbs.registerHelper(
  "verb",
  function (singular: string, plural: string, options: Handlebars.HelperOptions) {
    const root = options.data.root as { pronoun_plural?: boolean };
    return root.pronoun_plural ? plural : singular;
  },
);

const compiled = new Map<string, HandlebarsTemplateDelegate>();

function compile(source: string): HandlebarsTemplateDelegate {
  let fn = compiled.get(source);
  if (!fn) {
    fn = hbs.compile(source);
    compiled.set(source, fn);
  }
  return fn;
}

/** Fills omitted optional fields so `{{#if}}` blocks and `{{#each}}` behave predictably. */
function buildContext(
  schema: FieldSchema,
  data: CertificateData,
  qr: RenderOptions["qr"],
): Record<string, unknown> {
  const context: Record<string, unknown> = {};
  for (const field of schema) {
    context[field.name] = data[field.name] ?? (field.type === "list" ? [] : "");
  }
  const honorific = context.honorific;
  if (typeof honorific === "string" && honorific !== "") {
    Object.assign(context, derivePronouns(honorific));
  }
  if (qr) {
    context.verify_qr = qr.dataUri;
    context.verify_url = qr.url;
  }
  return context;
}

/**
 * The only way certificate HTML is produced. The admin preview, the Puppeteer PDF
 * and the verify page all call this, so they cannot diverge.
 */
export function renderCertificateHtml(
  templateVersion: RenderableTemplateVersion,
  data: CertificateData,
  options: RenderOptions = {},
): string {
  const html = compile(templateVersion.html_content)(
    buildContext(templateVersion.field_schema, data, options.qr),
  );
  return resolveAssets(html, options.resolveAsset);
}
