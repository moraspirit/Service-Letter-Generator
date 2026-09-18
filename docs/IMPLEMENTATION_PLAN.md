# Implementation Plan — MoraSpirit Certificate & Verification System

Companion to [architecture.md](architecture.md). The architecture says **what** the system is; this plan says **in what order it gets built**, and what "done" means at each step.

Work runs in **9 phases**. Each phase ends in something demonstrable, and no phase depends on a later one. Phases 1–6 build the issuance side; the public verification app is built in Phase 7, against data that already exists by then.

**Target:** one admin issues single or bulk "Certificate of Employment" service letters as one-page PDFs carrying a QR code; anyone scanning that QR code reaches a public page proving the letter is genuine.

---

## 0. Ground rules

- **Package manager:** pnpm workspaces + Turborepo.
- **Language:** TypeScript everywhere, `strict: true`. No `any` in shared packages.
- **Database:** Aiven for MySQL (free plan) for all development and testing. The production provider is deliberately undecided — see architecture §3. Nothing in the code may depend on a specific provider beyond the connection string.
- **Migrations:** only the issuance app runs them. Never edit an applied migration; add a new one.
- **Definition of done for every task:** it works against the Aiven test database, it has the tests listed in the phase's exit criteria, and `architecture.md` still matches reality. If a decision changes, update the architecture doc in the same commit.
- **Never commit:** `.env` files, real recipient data, the production connection string, or licensed fonts (see Phase 1).

### Repository layout

```
moraspirit-certificates/
├── apps/
│   ├── issuance/                 # Next.js — admin panel + PDF rendering (VPS, Docker)
│   └── verify/                   # Next.js — public verification page (Vercel)
├── packages/
│   ├── db/                       # Prisma schema, migrations, generated client
│   ├── certificate-render/       # Handlebars instance, helpers, renderCertificateHtml()
│   ├── certificate-templates/    # <slug>/template.hbs + schema.json (developer-authored)
│   ├── certificate-assets/       # letterhead images + font files (copied into both apps)
│   └── shared/                   # zod schemas, field-schema types, parsers, constants
├── docker/                       # Dockerfile + compose for the issuance app
├── scripts/                      # templates:publish, seed, backup helpers
└── docs/
    ├── README.md                 # index: what each document is and the reading order
    ├── architecture.md           # the decisions and the schema — the source of truth
    ├── IMPLEMENTATION_PLAN.md    # this file — build order and exit criteria
    ├── TASKS.md                  # progress tracker
    ├── RUNBOOK.md                # operations (written in Phase 8)
    └── samples/                  # reference material from MoraSpirit:
                                  #   the existing service letters (.pdf, .docx)
                                  #   and the pillar spreadsheet (.xlsx)
```

All project documentation lives in `docs/`. Nothing but `README.md` sits at the repository root.

### Tech stack by area

| Area | Choice |
|---|---|
| Framework | Next.js (App Router), React, TypeScript |
| Admin UI | Tailwind CSS + shadcn/ui, React Hook Form |
| ORM / DB | Prisma → MySQL 8 (Aiven in development) |
| Auth | Auth.js (NextAuth) credentials provider, argon2id hashing |
| Templating | Handlebars — one configured instance in a shared package |
| PDF | Puppeteer (headless Chromium); `pdf-lib` to verify page count |
| QR | `qrcode` (base64 PNG, inlined) |
| Spreadsheets | SheetJS (`xlsx`) for .xlsx, `papaparse` for .csv |
| Validation | zod, generated from each template's field schema |
| Sanitization | `sanitize-html` on rich-text values, at save time |
| Background jobs | Inngest (bulk ZIP + cleanup cron) |
| Rate limiting | `@upstash/ratelimit` + Upstash Redis (verify app); database-backed counter (admin login) |
| Testing | Vitest (unit), Playwright (E2E), PDF assertions via `pdf-lib` |
| Hosting | VPS + Docker (issuance), Vercel (verify), managed MySQL (database) |

---

## What to read before building

**Reading this plan alone is not enough.** It gives the build order, not the decisions — and every phase assumes the decisions are already settled.

| Document | Read it | Why |
|---|---|---|
| `docs/architecture.md` | **Before writing any code, in full** | The source of truth: the database schema, the pronoun and date rules, the sanitization model, the one-page rule, the security requirements, and the reasoning behind each. Around 20 of its decisions are not derivable from this plan. |
| `docs/IMPLEMENTATION_PLAN.md` | Then this file | Build order, what each phase contains, and what "done" means. |
| `docs/TASKS.md` | Daily, while building | The task list and progress. Also holds the open decisions (D1–D4) and anything blocked. |
| `docs/samples/` | Before Phase 1 and Phase 5 | The existing letters and the real spreadsheet. The template, the `list` parser and the import rules are all shaped by exactly what these files contain. |

**Per phase:** re-read the architecture sections that phase touches — they carry detail this plan deliberately does not repeat.

| Phase | Architecture sections |
|---|---|
| 0 | §3 (connectivity, environments), §4 (schema) |
| 1 | §5 (variables, pronouns, dates, `list` fields), §7 (assets, fonts, page rules) |
| 2 | §6 A (template publishing), §9 (admin login) |
| 3 | §6 B (issuance), §7 (page setup, one-page rule), §9 (sanitization, Puppeteer lockdown) |
| 4 | §4 (audit), §8 (editing capabilities) |
| 5 | §5 (`list` parsing), §6 C (import, duplicates) |
| 6 | §6 C step 17 (ZIP), §10 (VPS) |
| 7 | §6 D (verification), §9 (public exposure, rate limiting), §3 (connections) |
| 8 | §3 (provider gate), §9 (full security list), §10 (hosting) |

If code and the architecture doc ever disagree, the doc wins — or the doc gets updated in the same commit. It is never left stale.

---

## Phase 0 — Foundations

**Goal:** an empty but correct skeleton both apps build from, with a live test database.

**Build:**
1. pnpm workspace + Turborepo; both apps scaffolded with Next.js, TypeScript and Tailwind; shared ESLint/Prettier/tsconfig.
2. `packages/db`: Prisma schema transcribing **every** table from architecture §4 — `templates`, `template_versions`, `certificates`, `certificate_audit`, `import_batches`, `admin_users`, `login_attempts` — with the indexes, uniques and enums exactly as specified.
3. Aiven free MySQL instance created; TLS CA certificate downloaded and wired into the connection string (`?sslaccept=strict`).
4. First migration applied. Two database users created: `app_rw` (full read/write) and `verify_ro` (`SELECT` on `templates`, `template_versions`, `certificates` only).
5. `.env.example` for both apps; real `.env` files git-ignored.
6. Seed script creating one admin user and a handful of **fake** certificates.

**Exit criteria:**
- `pnpm build` passes for both apps.
- `prisma migrate deploy` applies cleanly to Aiven from an empty database.
- `verify_ro` can read `certificates`, cannot write anything, and cannot read `admin_users` or `certificate_audit`.
- `pnpm db:seed` rebuilds a working test dataset in one command.

---

## Phase 1 — Shared rendering core

**Goal:** the single place that turns a template plus data into HTML. Built before any UI, because three surfaces depend on it behaving identically.

**Build:**
1. `packages/shared`: the `FieldSchema` type (name, label, type `text|date|select|richtext|list`, required, options, `public_summary`, `dedupe`) and a zod-schema generator built from it.
2. **`list` parser** (architecture §5): split on line breaks; strip `•`, `-`, `*` and Word's `U+F0B7`; drop blanks; preserve order. Unit-tested against the real strings in `Special Projects Pillar'25 service letters.xlsx`.
3. `packages/certificate-render`:
   - one configured Handlebars instance — no other package may register helpers;
   - pronouns derived from `honorific` (Mr. → He/him/his + singular verbs; Ms. → She/her/her; Mx. → They/them/their + plural verbs), with capitalized variants;
   - a `verb` helper (`{{verb "is" "are"}}`) and a `formatDate` helper producing **"28th of April 2025"** in the `Asia/Colombo` time zone;
   - `renderCertificateHtml(templateVersion, data)` as the only rendering entry point;
   - asset resolution: rewrite `/certificate-assets/...` to base64 data URIs when rendering for Puppeteer, leave them as paths when rendering for a browser.
4. `packages/certificate-assets`: the letterhead image extracted from the samples, plus the chosen font files. **Times New Roman cannot be bundled** — use Liberation Serif or Tinos. A build step copies the folder into both apps' `public/certificate-assets/`.
5. `packages/certificate-templates/moraspirit-service-letter/`: `template.hbs` + `schema.json` reproducing the sample letter — US Letter page, full-bleed letterhead, US spelling, a `{{#if special_points}}` section, signatory fields, and a QR placeholder in the footer.

**Exit criteria:**
- Rendering the sample data reproduces the Dilni Muthukuda letter's wording and layout.
- Pronoun tests pass for all three honorifics — the bug in the source PDF ("Ms. … he pursues") is impossible to reproduce.
- A "General" letter (no `special_points`) omits that whole section cleanly.

---

## Phase 2 — Issuance app shell, auth and templates

**Goal:** a login-protected admin panel that knows about templates.

**Build:**
1. Auth.js credentials login: argon2id hashes, generic error messages, `HttpOnly`/`SameSite=Lax` cookie, 8-hour sessions, CSRF protection on mutations.
2. Login rate limiting through the `login_attempts` table: 5 failures per email + IP per 15 minutes, with old rows purged.
3. A CLI script to create an admin account — there is no public sign-up.
4. Admin shell: layout, navigation, and a session guard on every route and API handler.
5. **`templates:publish` script** (architecture §6 A): hashes each `template.hbs` + `schema.json`, inserts a new `template_versions` row when the hash changed, updates `templates.current_version_id`, skips unchanged templates. Rejects any template containing `<script>`, inline event handlers or external URLs.
6. Read-only template screens: list, version history, and preview of a version rendered with sample data.

**Exit criteria:**
- Every route redirects to login when signed out; no admin API responds without a session.
- Six failed logins in a row are blocked, and the block expires.
- Running `templates:publish` twice creates exactly one version; changing one character creates a second.
- A template containing a `<script>` tag is rejected by the publish script.

---

## Phase 3 — Single certificate issuance and PDF

**Goal:** the core loop — fill a form, get a verifiable PDF.

**Build:**
1. A form generated automatically from the selected template version's field schema (text/date/select/rich-text/list inputs; `list` is a textarea, one bullet per line).
2. Live preview in the browser calling `renderCertificateHtml` from the shared package.
3. Submit handler: zod validation, rich-text sanitization at save time (strict allowlist: `p br strong em ul ol li`, no attributes), `dedupe_key` computation, a duplicate warning with "Issue anyway", then **one transaction** inserting the `certificates` row and its `created` audit row.
4. PDF render service on the VPS:
   - a reused browser instance, capped concurrency, per-render timeout;
   - **Puppeteer lockdown** — JavaScript disabled, request interception aborting everything that is not a `data:` URI;
   - a QR code for `https://verify.<domain>/verify/{uuid}`, generated and inlined;
   - page options taken from the template (`format: Letter`, `margin: 0`, `printBackground: true`);
   - the **one-page rule** — measure content height, then confirm the produced PDF's page count with `pdf-lib`. More than one page means no PDF and an error naming the certificate and the offending field.
5. A download route that streams the PDF; re-downloading later re-renders from the same stored data and template version.

**Exit criteria:**
- An issued certificate produces a one-page US Letter PDF whose QR code resolves to the right UUID.
- Text is selectable vector text, not an image, and the bundled font is embedded.
- A deliberately overlong `special_points` fails with a clear error and writes **no** PDF.
- Cutting the VPS's network access does not change the output — proof nothing is fetched at render time.
- Issuing a certificate always leaves exactly one `created` audit row.

---

## Phase 4 — Certificate management

**Goal:** everything an admin does to a certificate after issuing it.

**Build:**
1. Certificate list: search by `member_id` and recipient name, filter by template and status, pagination.
2. Detail page: stored data, template version used, issue date, status, and PDF re-download.
3. Edit: the same generated form, a **required reason**, and old and new `data` written to `certificate_audit` in the same transaction.
4. Revoke and restore: required reason, sets `revoked_at` and `revocation_reason`, writes the audit row. Certificates are never deleted.
5. Audit history on the detail page — who changed what, when and why.

**Exit criteria:**
- No path changes a certificate without writing an audit row (verified by a test that edits, revokes and restores, then asserts the trail).
- An edited certificate keeps its original `template_version_id`.
- Revoking deletes nothing.

---

## Phase 5 — Bulk import (.xlsx / .csv)

**Goal:** turn the real pillar spreadsheet into certificates.

**Build:**
1. Upload accepting `.xlsx` (SheetJS, preferred) and UTF-8 `.csv` (papaparse, BOM tolerated), with a worksheet picker for multi-sheet workbooks.
2. Header matching that ignores case and whitespace; unknown columns reported and ignored; missing required columns fail the upload.
3. Per-row processing: trim every cell, parse `list` cells, map `Gender` → honorific (Male → Mr., Female → Ms.; anything else fails the row), read real Excel date cells directly, and accept text dates only as `YYYY-MM-DD` or `DD/MM/YYYY`.
4. A validation report listing every failing row with its reason. Nothing is committed until all rows pass.
5. Duplicate detection: a matching `file_hash` warns that the file was already imported; per-row `dedupe_key` matches flag existing certificates with a link. Each flagged row is Skip (default) or Issue anyway.
6. Commit: one transaction creating the `import_batches` row, all `certificates` rows, and their `created` audit rows.
7. Batch list and batch detail pages.

**Exit criteria:**
- The real 39-row sheet imports, with the incomplete row (SPL2510) rejected and reported rather than issued.
- "General" rows produce letters with no special section; "Special" rows include it.
- Re-uploading the same file warns before anything is written.
- Bullet cells become proper `<li>` items, with curly quotes and apostrophes intact.

---

## Phase 6 — Bulk ZIP export

**Goal:** hand the admin every PDF from a batch at once, without blocking a request.

**Build:**
1. Inngest wired into the issuance app (`/api/inngest`, signing key), on Inngest Cloud's free tier.
2. The ZIP job: one step per certificate calling the same render function, writing into `/data/tmp-exports/{batch_id}/`, then zipping. Puppeteer concurrency capped at 2–3.
3. Progress written to the batch row (`zip_status`, `zip_rendered_count`) and shown in the UI.
4. Failures — including one-page-rule failures — collected into a job report, while the rest still complete.
5. An admin-authenticated download route streaming the ZIP; never a public static path.
6. A cleanup cron deleting ZIPs and their folders 24 hours after generation (`zip_expires_at`), moving the status to `expired`.

**Exit criteria:**
- A 39-certificate batch produces a ZIP containing 39 correctly named PDFs.
- Killing the job mid-run and retrying neither duplicates work nor corrupts the ZIP.
- The download route refuses an unauthenticated request.
- An expired ZIP is gone from disk, and the UI offers to regenerate it.

---

## Phase 7 — Public verification app (Vercel)

**Goal:** the page the QR code points at.

**Build:**
1. A minimal Next.js app serving `/verify/[uuid]` only, with its own Prisma client using the `verify_ro` credentials, deployed in the same region as the database.
2. A Node.js serverless function (not Edge), `force-dynamic`, `Cache-Control: no-store` — no caching, per architecture §6 D.
3. An invalid UUID format returns 404 before any database query.
4. Three states: not found; revoked (status and `revoked_at` only — never the content or the reason); and active.
5. The active page: a verified badge plus only `public_summary` fields, then a **"View full certificate"** control rendering the compiled HTML inside a sandboxed `<iframe srcdoc>` with no `allow-scripts`.
6. Upstash rate limiting in middleware: 60 requests per minute per IP, **failing open** on Upstash errors or timeouts.
7. A Prisma singleton with `connection_limit=1` and a low pool timeout.

**Exit criteria:**
- Scanning a real PDF's QR code with a phone opens the correct verification page.
- A revoked certificate shows the revoked state, and its content is absent from the HTML source.
- Narrative fields never appear until "View full certificate" is used.
- With the VPS stopped, verification still works — the actual point of the split.
- Blocking Upstash leaves the page working.
- `verify_ro` cannot write, and cannot read `admin_users` or `certificate_audit`.

---

## Phase 8 — Hardening, deployment and handover

**Goal:** something that can be operated by someone who did not build it.

**Build:**
1. Dockerfile and compose for the issuance app, with Chromium and fonts inside the image and a volume for `/data/tmp-exports`. HTTPS through a reverse proxy.
2. The Vercel project for the verification app: environment variables, region, and the `verify.<domain>` custom domain.
3. **The production database decision**, using the architecture §3 gate — including the PeekHosting checks (TLS, remote access, MySQL 8, `max_connections`, backups, privilege scoping, region). Migrate, re-create both users, re-test.
4. Off-site automated backups of the production database, plus a **restore rehearsal**, done before any real certificate is issued.
5. A security pass against architecture §9: Puppeteer lockdown, sanitization, rate limits, session settings, TLS everywhere, secrets only in environment variables.
6. A load sanity check: simulate an event rush against the verify page and watch connection counts.
7. An operations runbook: deploying, publishing a template, adding an asset, rotating credentials, restoring a backup, and what to do when a ZIP job fails.

**Exit criteria:**
- A fresh deployment from a clean checkout succeeds using the runbook alone.
- A restore from backup has been performed successfully at least once.
- Real certificates are issued only after all of the above.

---

## Phase 9 — Post-launch (optional)

Build these only if real use asks for them: a richer template version UI, bulk revoke, exporting a batch's UUIDs for mail-merge, a second signatory, emailing letters to recipients, verification-scan analytics, self-hosted Inngest.

---

## Cross-cutting concerns

**Testing:** unit tests for the `list` parser, pronoun mapping, date helper and dedupe key; integration tests for issuance, audit-on-change and import; PDF assertions for page count, page size and embedded fonts; one E2E path covering login → issue → download → verify.

**Environment variables**

| App | Variables |
|---|---|
| issuance | `DATABASE_URL` (app_rw, TLS), `AUTH_SECRET`, `VERIFY_BASE_URL`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`, `EXPORT_DIR` |
| verify | `DATABASE_URL` (verify_ro, TLS, `connection_limit=1`), `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |

**Risks to watch**

| Risk | Mitigation |
|---|---|
| Content overflows one page | The one-page rule fails the render (Phase 3) — a broken PDF never ships |
| Connection exhaustion on an uncached verify page | `connection_limit=1`, singleton client, the §3 provider gate; a short cache is the documented escape hatch |
| Production database not yet chosen | The Phase 8 gate; no code depends on the provider |
| Font licensing | A metric-compatible OFL/Apache substitute chosen in Phase 1 |
| Template drift between apps | One shared render package; local helpers are not allowed |
