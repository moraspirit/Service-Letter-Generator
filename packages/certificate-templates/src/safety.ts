// Templates are trusted, reviewed code (AGENTS.md §5), but the publish script and
// CI still refuse the patterns that would let a template reach the network or run
// script: Puppeteer and the verify page both depend on templates being inert.

export interface SafetyViolation {
  rule: string;
  excerpt: string;
}

const ALLOWED_REFERENCE =
  /^(?:\/certificate-assets\/[A-Za-z0-9._\-/]+|data:[^\s]*|#[\w-]*|\{\{\s*[\w.]+\s*\}\})$/;

const FORBIDDEN_TAGS = /<\s*(script|iframe|object|embed|link|base|form)\b/gi;
// <meta charset> is fine; http-equiv can redirect or set policies.
const META_HTTP_EQUIV = /<\s*meta\b[^>]*http-equiv/gi;
const INLINE_HANDLER = /<[^>]*\son[a-z]+\s*=/gi;
const JS_URL = /javascript\s*:/gi;
const ABSOLUTE_URL = /(?:https?:)?\/\/[^\s"')]+/gi;
const ATTR_REFERENCE = /\b(?:src|href|srcset|action|poster)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
const CSS_URL = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/gi;
const CSS_IMPORT = /@import\b/gi;

function excerpt(source: string, index: number): string {
  return source.slice(Math.max(0, index - 20), index + 60).replace(/\s+/g, " ");
}

/** Returns every violation found in a template's source; an empty array means it is safe to publish. */
export function checkTemplateSafety(html: string): SafetyViolation[] {
  const violations: SafetyViolation[] = [];
  const add = (rule: string, source: string, index: number) =>
    violations.push({ rule, excerpt: excerpt(source, index) });

  for (const m of html.matchAll(FORBIDDEN_TAGS)) {
    add(`forbidden tag <${m[1]!.toLowerCase()}>`, html, m.index);
  }
  for (const m of html.matchAll(META_HTTP_EQUIV)) add("meta http-equiv", html, m.index);
  for (const m of html.matchAll(INLINE_HANDLER)) add("inline event handler", html, m.index);
  for (const m of html.matchAll(JS_URL)) add("javascript: URL", html, m.index);
  for (const m of html.matchAll(CSS_IMPORT)) add("CSS @import", html, m.index);
  for (const m of html.matchAll(ABSOLUTE_URL)) add("external URL", html, m.index);

  for (const m of html.matchAll(ATTR_REFERENCE)) {
    const value = (m[1] ?? m[2] ?? "").trim();
    if (!ALLOWED_REFERENCE.test(value)) add("disallowed resource reference", html, m.index);
  }
  for (const m of html.matchAll(CSS_URL)) {
    const value = (m[1] ?? m[2] ?? m[3] ?? "").trim();
    if (!ALLOWED_REFERENCE.test(value)) add("disallowed resource reference", html, m.index);
  }
  return violations;
}
