import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { FieldSchema } from "@moraspirit/shared";
import { formatDate } from "./format-date";
import { createDataUriResolver } from "./node";
import { derivePronouns } from "./pronouns";
import { renderCertificateHtml } from "./render";

const schema: FieldSchema = [
  { name: "recipient_name", label: "Name", type: "text", required: true },
  {
    name: "honorific",
    label: "Honorific",
    type: "select",
    required: true,
    options: ["Mr.", "Ms.", "Mx."],
  },
  { name: "start_date", label: "Start", type: "date", required: true },
  { name: "intro", label: "Intro", type: "richtext", required: false },
  { name: "general_points", label: "General", type: "list", required: true },
  { name: "special_points", label: "Special", type: "list", required: false },
];

const body = [
  '{{recipient_name}}. {{Pronoun_subject}} {{verb "is" "are"}} dedicated; ',
  "{{pronoun_possessive}} work impressed everyone who met {{pronoun_object}}. ",
  "Since {{formatDate start_date}}.",
  "{{#if special_points}}<h2>Special</h2>{{#each special_points}}<li>{{this}}</li>{{/each}}{{/if}}",
  "{{{intro}}}",
].join("");

const tv = { html_content: body, field_schema: schema };
const base = { recipient_name: "Test Person", start_date: "2025-04-28", general_points: ["a"] };

describe("renderCertificateHtml pronouns", () => {
  it("Mr. gets he/him/his with singular verbs", () => {
    const html = renderCertificateHtml(tv, { ...base, honorific: "Mr." });
    expect(html).toContain("He is dedicated; his work impressed everyone who met him.");
  });

  it("Ms. gets she/her/her with singular verbs", () => {
    const html = renderCertificateHtml(tv, { ...base, honorific: "Ms." });
    expect(html).toContain("She is dedicated; her work impressed everyone who met her.");
  });

  it("Mx. gets they/them/their with plural verbs", () => {
    const html = renderCertificateHtml(tv, { ...base, honorific: "Mx." });
    expect(html).toContain("They are dedicated; their work impressed everyone who met them.");
  });

  it("does not produce 'Ms. ... he' (pronoun always follows the honorific)", () => {
    const html = renderCertificateHtml(
      { ...tv, html_content: "{{recipient_name}} {{pronoun_subject}} pursues" },
      { ...base, honorific: "Ms." },
    );
    expect(html).toBe("Test Person she pursues");
    expect(html).not.toMatch(/\bhe pursues/);
  });

  it("rejects an unknown honorific", () => {
    expect(() => derivePronouns("Dr.")).toThrow(/Unknown honorific/);
  });
});

describe("renderCertificateHtml content", () => {
  it("skips the special block when the list is empty or omitted, renders it when present", () => {
    const without = renderCertificateHtml(tv, { ...base, honorific: "Mr." });
    expect(without).not.toContain("Special");
    const withSpecial = renderCertificateHtml(tv, {
      ...base,
      honorific: "Mr.",
      special_points: ["One", "Two"],
    });
    expect(withSpecial).toContain("<h2>Special</h2><li>One</li><li>Two</li>");
  });

  it("escapes plain values but not triple-stash rich text", () => {
    const html = renderCertificateHtml(tv, {
      ...base,
      recipient_name: "<script>x</script>",
      honorific: "Mr.",
      intro: "<p>ok</p>",
    });
    expect(html).toContain("&lt;script&gt;x&lt;/script&gt;");
    expect(html).toContain("<p>ok</p>");
  });

  it("does not let data override derived pronouns", () => {
    const html = renderCertificateHtml(
      { ...tv, html_content: "{{pronoun_subject}}" },
      { ...base, honorific: "Ms.", pronoun_subject: "he" },
    );
    expect(html).toBe("she");
  });
});

describe("formatDate", () => {
  it.each([
    ["2025-04-28", "28th of April 2025"],
    ["2025-01-01", "1st of January 2025"],
    ["2025-02-02", "2nd of February 2025"],
    ["2025-03-03", "3rd of March 2025"],
    ["2025-05-11", "11th of May 2025"],
    ["2025-05-12", "12th of May 2025"],
    ["2025-05-13", "13th of May 2025"],
    ["2025-05-21", "21st of May 2025"],
    ["2025-05-22", "22nd of May 2025"],
    ["2025-05-23", "23rd of May 2025"],
    ["2025-05-31", "31st of May 2025"],
  ])("%s -> %s", (input, expected) => {
    expect(formatDate(input)).toBe(expected);
  });

  it("converts instants to Asia/Colombo (UTC+05:30)", () => {
    // 20:00 UTC on the 27th is already 01:30 on the 28th in Colombo.
    expect(formatDate(new Date("2025-04-27T20:00:00Z"))).toBe("28th of April 2025");
    expect(formatDate(new Date("2025-04-27T17:00:00Z"))).toBe("27th of April 2025");
  });

  it("rejects malformed input", () => {
    expect(() => formatDate("28/04/2025")).toThrow();
    expect(() => formatDate("2025-13-01")).toThrow();
  });
});

describe("asset resolution", () => {
  const html =
    '<img src="/certificate-assets/logo.svg"><div style="background:url(\'/certificate-assets/logo.svg\')">';
  const assetTv = { html_content: html, field_schema: [] as FieldSchema };

  it("leaves paths alone when no resolver is given (browser)", () => {
    expect(renderCertificateHtml(assetTv, {})).toBe(html);
  });

  it("inlines assets as data URIs and blocks path traversal", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "assets-"));
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "logo.svg"), "<svg/>");
    const out = renderCertificateHtml(assetTv, {}, { resolveAsset: createDataUriResolver(dir) });
    expect(out).not.toContain("/certificate-assets/");
    expect(out).toContain("data:image/svg+xml;base64,PHN2Zy8+");

    const resolver = createDataUriResolver(dir);
    expect(() => resolver("/certificate-assets/../secret.png")).toThrow(/escapes/);
    expect(() => resolver("/certificate-assets/missing.svg")).toThrow(/Missing/);
  });
});
