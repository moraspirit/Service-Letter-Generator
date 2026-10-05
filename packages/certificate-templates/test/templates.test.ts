import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  applyDefaults,
  buildZodSchema,
  parseTemplateSchemaFile,
  type CertificateData,
} from "@moraspirit/shared";
import { renderCertificateHtml } from "@moraspirit/certificate-render";
import { createDataUriResolver } from "@moraspirit/certificate-render/node";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetsDir = path.resolve(root, "../certificate-assets");

const slugs = readdirSync(root, { withFileTypes: true })
  .filter((e) => e.isDirectory() && e.name.endsWith("-letter"))
  .map((e) => e.name);

function load(slug: string) {
  const html_content = readFileSync(path.join(root, slug, "template.hbs"), "utf8");
  const file = parseTemplateSchemaFile(
    JSON.parse(readFileSync(path.join(root, slug, "schema.json"), "utf8")),
  );
  return { html_content, field_schema: file.fields };
}

// Fabricated data only.
const person: CertificateData = {
  member_id: "TEST001",
  recipient_name: "Alex Example",
  honorific: "Ms.",
  pillar_name: "Test Pillar",
  start_date: "2025-04-28",
  end_date: "2026-04-29",
  general_points: ["First general task.", "Second general task."],
};

describe.each(slugs)("template %s", (slug) => {
  const tv = load(slug);
  const data = applyDefaults(
    tv.field_schema,
    slug === "special-letter" ? { ...person, special_points: ["Led project X."] } : person,
  );

  it("has a valid schema and the sample data passes its zod validation", () => {
    expect(buildZodSchema(tv.field_schema).safeParse(data).success).toBe(true);
  });

  it("only uses variables the schema (or the render context) provides", () => {
    const provided = new Set([
      ...tv.field_schema.map((f) => f.name),
      "pronoun_subject",
      "Pronoun_subject",
      "pronoun_object",
      "Pronoun_object",
      "pronoun_possessive",
      "Pronoun_possessive",
      "verify_qr",
    ]);
    const used = [
      ...tv.html_content.matchAll(/\{\{\{?#?(?:if |each )?([A-Za-z_]+)\s*\}?\}\}/g),
    ].map((m) => m[1]!);
    const helperWords = new Set(["else", "this", "if", "each"]);
    for (const name of used) if (!helperWords.has(name)) expect(provided).toContain(name);
  });

  it.each([
    ["Mr.", "he", "pursues"],
    ["Ms.", "she", "pursues"],
    ["Mx.", "they", "pursue"],
  ])("renders for %s with matching pronouns", (honorific, subject) => {
    const html = renderCertificateHtml(tv, { ...data, honorific });
    expect(html).not.toContain("{{");
    expect(html).toContain(`${honorific} Alex Example`);
    expect(html).toContain("28th of April 2025");
    expect(html).toContain("29th of April 2026");
    expect(html).toContain("Heminda Jayaweera");
    if (honorific !== "Ms.") expect(html).not.toMatch(/\bshe\b|\bher\b/i);
    if (honorific === "Ms.") expect(html).not.toMatch(/\bhe\b|\bhis\b|\bhim\b/i);
    expect(html.toLowerCase()).toContain(subject);
  });

  it("uses the plural verb form only for Mx.", () => {
    if (slug === "general-letter") {
      expect(renderCertificateHtml(tv, { ...data, honorific: "Mx." })).toContain("they pursue.");
      expect(renderCertificateHtml(tv, { ...data, honorific: "Ms." })).toContain("she pursues.");
    } else {
      expect(renderCertificateHtml(tv, { ...data, honorific: "Mx." })).toContain("they have made");
      expect(renderCertificateHtml(tv, { ...data, honorific: "Mr." })).toContain("he has made");
    }
  });

  it("has the special section only in the Special Letter, and requires its points there", () => {
    const html = renderCertificateHtml(tv, data);
    const field = tv.field_schema.find((f) => f.name === "special_points");
    if (slug === "special-letter") {
      expect(field?.required).toBe(true);
      expect(html).toContain("notable contributions");
      expect(html).toContain("<li>Led project X.</li>");
    } else {
      expect(field).toBeUndefined();
      expect(html).not.toContain("notable contributions");
      expect(html).not.toContain("Led project X.");
    }
  });

  it("is published under exactly the names General Letter and Special Letter", () => {
    const name = JSON.parse(readFileSync(path.join(root, slug, "schema.json"), "utf8")).name;
    expect(name).toBe(slug === "general-letter" ? "General Letter" : "Special Letter");
  });

  it("renders every general point as a list item, in order", () => {
    const html = renderCertificateHtml(tv, data);
    expect(html.indexOf("First general task.")).toBeLessThan(html.indexOf("Second general task."));
    expect(html.match(/<li>/g)).toHaveLength(slug === "special-letter" ? 3 : 2);
  });

  it("escapes values", () => {
    const html = renderCertificateHtml(tv, { ...data, recipient_name: "<b>x</b>" });
    expect(html).not.toContain("<b>x</b>");
  });

  it("shows the QR placeholder in previews and the QR image when supplied", () => {
    expect(renderCertificateHtml(tv, data)).toContain('class="qr-placeholder"');
    const withQr = renderCertificateHtml(tv, data, {
      qr: { dataUri: "data:image/png;base64,AAAA", url: "https://verify.example/verify/x" },
    });
    expect(withQr).toContain('src="data:image/png;base64,AAAA"');
    expect(withQr).not.toContain('class="qr-placeholder"');
  });

  it("references only assets that exist, and inlines them all for Puppeteer", () => {
    const html = renderCertificateHtml(tv, data, {
      resolveAsset: createDataUriResolver(assetsDir),
    });
    expect(html).not.toContain("/certificate-assets/");
    expect(html).toContain("data:image/jpeg;base64,");
    expect(html).toContain("data:font/woff2;base64,");
  });

  it("stays a US Letter, script-free document", () => {
    expect(tv.html_content.startsWith("<!doctype html>")).toBe(true);
    expect(tv.html_content).toContain("size: 8.5in 11in");
    expect(tv.html_content).not.toMatch(/<script|\son[a-z]+=|https?:\/\//i);
  });
});
