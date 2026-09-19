import { describe, expect, it } from "vitest";
import { canonicalJson, checkTemplateSafety, computeContentHash, loadAllTemplates } from "../src";

describe("checkTemplateSafety", () => {
  it("accepts every committed template", () => {
    const all = loadAllTemplates();
    expect(all.length).toBeGreaterThanOrEqual(2);
    for (const t of all) expect(checkTemplateSafety(t.htmlContent), t.slug).toEqual([]);
  });

  it.each([
    ["script tag", "<p>x</p><script>alert(1)</script>"],
    ["uppercase script", "<SCRIPT src=x></SCRIPT>"],
    ["inline handler", '<img src="/certificate-assets/a.jpg" onerror="x()">'],
    ["inline handler, spaced", "<div  onclick = 'x()'>a</div>"],
    ["javascript: URL", '<a href="javascript:x()">a</a>'],
    ["external image", '<img src="https://evil.example/a.png">'],
    ["protocol-relative URL", '<img src="//evil.example/a.png">'],
    ["external CSS url()", "<style>a{background:url(https://evil.example/a.png)}</style>"],
    ["relative CSS url()", '<style>a{background:url("../secret.png")}</style>'],
    ["@import", '<style>@import "/certificate-assets/x.css";</style>'],
    ["iframe", "<iframe src=x></iframe>"],
    ["link tag", '<link rel="stylesheet" href="/certificate-assets/x.css">'],
    ["form", '<form action="/certificate-assets/x"></form>'],
    ["meta refresh", '<meta http-equiv="refresh" content="0;url=/">'],
    ["unknown src path", '<img src="/other/a.png">'],
  ])("rejects %s", (_name, html) => {
    expect(checkTemplateSafety(html).length).toBeGreaterThan(0);
  });

  it("allows asset paths, data URIs and the QR placeholder variable", () => {
    const html =
      '<img src="/certificate-assets/a.jpg"><img src="{{verify_qr}}"><img src="data:image/png;base64,AAAA">' +
      "<style>a{background:url('/certificate-assets/a.jpg')}</style>";
    expect(checkTemplateSafety(html)).toEqual([]);
  });
});

describe("content hash", () => {
  const html = "<p>{{a}}</p>";
  const schema = [{ name: "a", label: "A", type: "text" as const, required: true }];

  it("ignores key order and formatting of the schema", () => {
    const reordered = [{ required: true, type: "text" as const, label: "A", name: "a" }];
    expect(computeContentHash(html, reordered)).toBe(computeContentHash(html, schema));
  });

  it("changes when a single character of the HTML or schema changes", () => {
    const base = computeContentHash(html, schema);
    expect(computeContentHash(html + " ", schema)).not.toBe(base);
    expect(computeContentHash(html, [{ ...schema[0]!, label: "B" }])).not.toBe(base);
  });

  it("canonicalJson sorts keys deeply and drops undefined", () => {
    expect(canonicalJson({ b: 1, a: { d: undefined, c: [2, { z: 1, y: 2 }] } })).toBe(
      '{"a":{"c":[2,{"y":2,"z":1}]},"b":1}',
    );
  });
});
