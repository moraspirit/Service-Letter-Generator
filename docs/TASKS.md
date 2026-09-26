# Task Tracker — MoraSpirit Certificate & Verification System

Progress tracker for [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md). Architecture decisions live in [architecture.md](architecture.md).

**How to use:** tick a task only when it works against the Aiven test database and its phase's exit criteria still pass. Update the status table when a phase starts or finishes. Add new tasks at the end of their phase, keeping the ID sequence.

**Status key:** `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked (add a note)

---

## Progress at a glance

| Phase | Scope | Status | Notes |
|---|---|---|---|
| 0 | Foundations | ✅ Complete | All of P0-01→P0-12 done |
| 1 | Shared rendering core | ✅ Complete | Both templates render to one US Letter page; see the notes under P1-17 |
| 2 | App shell, auth, templates | 🔄 Built, awaiting owner | Everything works; the owner still has to run `pnpm admin:create` once (P2-05) |
| 3 | Single issuance + PDF | 🔄 Built, awaiting owner | M1 reached in automated checks; owner to click through the form once (P3-14) |
| 4 | Certificate management | 🔄 Built, awaiting owner | Owner to click through edit / revoke / restore once (P4-09) |
| 5 | Bulk import | 🔄 Built, awaiting owner | Automated checks pass, incl. the real sheet (analysis only); owner to click through the import UI once (P5-16) |
| 6 | Bulk ZIP export | 🔄 Built, awaiting owner | Verified with the real Inngest Dev Server and Chromium; owner to click through once (P6-11) |
| 7 | Verification app | 🔄 Built, awaiting deployment | Works against the Aiven dev database; a phone scan of a real PDF needs the deployed domain (Phase 8) |
| U | Interface & design system | 🔄 Built, awaiting owner | Both apps on one light-only design system; owner to click through and confirm the look |
| 8 | Hardening & deploy | ⬜ Not started | Gated on the production DB decision |
| 9 | Post-launch | ⬜ Optional | Only if real use asks |

**Milestones**

| # | Milestone | Reached when |
|---|---|---|
| M1 | First PDF | Phase 3 complete — an admin can issue one letter and download it |
| M2 | First verified scan | Phase 7 complete — a phone scan of that PDF opens a working verify page |
| M3 | First real batch | Phase 6 complete — the 39-row sheet becomes a ZIP of PDFs |
| M4 | Production ready | Phase 8 complete — deployed, backed up, restore rehearsed |

---

## Open decisions

| ID | Decision | Status | Needed by |
|---|---|---|---|
| D1 | Production database provider | ⏳ Deferred until the system runs against Aiven. Candidates: paid Aiven, DigitalOcean, Neon, PeekHosting (only if it passes the architecture §3 gate) | Phase 8 |
| D2 | Font substitute for Times New Roman | ✅ **Liberation Serif** (OFL) chosen 2026-09-19; never change it, since that moves every line break | — |
| D3 | Whether a second template is needed for the longer "outstanding contributions" wording | ✅ **Two templates.** MoraSpirit confirmed on 2026-09-19 that the long wording is still used, so it gets its own template (see P1-18). `recipient_surname` is optional and used by whichever wording refers to the recipient by surname | — |
| D4 | VPS provider and region | ⏳ Must sit near the database region | Phase 8 |
| D7 | Dev `avnadmin` password was printed into a session transcript on 2026-09-19 | ✅ Rotated by the owner. `app_rw` / `verify_ro` passwords were generated locally and never printed | — |
| D6 | Prisma is pinned to **7.10.0**; 8.0.0 exists only as a release candidate and the CLI nags about it. Revisit once 8 is stable — the upgrade changes client instantiation | ⏳ Open | Phase 8 |
| ✅ Kept as-is (owner approved 2026-09-19) | — |

---

## Phase 0 — Foundations

- [x] **P0-01** Create the pnpm workspace + Turborepo skeleton with the layout from the plan
- [x] **P0-02** Scaffold `apps/issuance` (Next.js + TypeScript + Tailwind)
- [x] **P0-03** Scaffold `apps/verify` (Next.js + TypeScript + Tailwind, no other features)
- [x] **P0-04** Shared ESLint / Prettier / tsconfig and the `pnpm build` pipeline
- [x] **P0-05** Aiven for MySQL free instance running (MySQL 8.4.8, DigitalOcean `blr`), database `mora-spirit` created, CA certificate saved to `.cert/ca.pem`
- [x] **P0-06** `packages/db`: Prisma schema for all 7 tables from architecture §4, with indexes, uniques and enums
- [x] **P0-07** First migration `20260919131700_init` applied to Aiven over verified TLS (`sslaccept=strict&sslcert=../../.cert/ca.pem`); all 7 tables confirmed present
- [x] **P0-08** Created the `app_rw` user via `scripts/create-db-users.js` — SELECT/INSERT/UPDATE/DELETE plus CREATE/ALTER/DROP/INDEX/REFERENCES on `mora-spirit`.*; password written to `apps/issuance/.env.local`
- [x] **P0-09** Created the `verify_ro` user (`SELECT` on those three tables only) via the same script; proved by its `--verify-only` checks that it cannot write, cannot DROP, and cannot read `admin_users`, `certificate_audit`, `import_batches` or `login_attempts`
- [x] **P0-10** `.env.example` for both apps and `packages/db`; confirmed real `.env` files are git-ignored and the examples are not
- [x] **P0-11** Seed script (`pnpm db:seed`, also run by `prisma migrate reset`): one admin user, an import batch, and four fabricated certificates (one revoked, and one pinned to the oldest version when the template has several) with their audit rows. It creates no templates of its own: it pins to the published `moraspirit-service-letter`, so run `pnpm templates:publish` first (changed after Phase U, so the issue picker lists only real templates)
- [x] **P0-12** ✅ Exit criteria verified — `pnpm build`/`lint`/`typecheck`/`format:check` pass, migration applies to Aiven over verified TLS, `verify_ro` restricted (11/11 privilege checks), `pnpm db:seed` rebuilds the dataset repeatably

## Phase 1 — Shared rendering core

- [x] **P1-01** `packages/shared`: `FieldSchema` types for `text|date|select|richtext|list` incl. `required`, `options`, `public_summary`, `dedupe`
- [x] **P1-02** zod schema generator built from a field schema (used later by form, import and API)
- [x] **P1-03** `list` parser — split lines, strip `•` `-` `*` `U+F0B7`, drop blanks, keep order
- [x] **P1-04** Unit tests for the `list` parser using the real cell strings from the pillar spreadsheet (fixtures use synthetic wording in the real cells' exact format, so no sample content is committed)
- [x] **P1-05** `packages/certificate-render`: the single configured Handlebars instance
- [x] **P1-06** Honorific → pronoun mapping (Mr./Ms./Mx.) with capitalized variants
- [x] **P1-07** `verb` helper for singular/plural agreement
- [x] **P1-08** `formatDate` helper producing "28th of April 2025" in `Asia/Colombo`
- [x] **P1-09** `renderCertificateHtml(templateVersion, data)` as the only entry point
- [x] **P1-10** Asset resolution: data URIs for Puppeteer, plain paths for the browser
- [x] **P1-11** Extract the letterhead image from the samples into `packages/certificate-assets` (`mora-letterhead-v1.jpg`, taken from the current PDF because the .docx copies carry outdated contact names)
- [x] **P1-12** Choose and add the font files (D2), with licences recorded in the package README (Liberation Serif 2.1.5, 4 styles, lossless WOFF2, not subset — see README)
- [x] **P1-13** Build step copying assets into both apps' `public/certificate-assets/` (`sync.mjs`, run by each app's `predev`/`prebuild`; the apps depend on the package so Turborepo rebuilds when an asset changes)
- [x] **P1-14** Author `moraspirit-service-letter/template.hbs` — US Letter, full-bleed letterhead, US spelling, QR placeholder
- [x] **P1-15** Author its `schema.json` with the field set from architecture §5
- [x] **P1-16** Pronoun tests for all three honorifics, including the "Ms. … he pursues" case
- [x] **P1-18** Author the second template (long "outstanding contributions" wording) with its own `schema.json` — decision D3
- [x] **P1-17** ✅ Exit criteria verified (sample letter reproduced; General letter omits the special section). Rendered both templates to PDF with headless Edge: one Letter page each, Liberation Serif embedded, the long-wording letter with 3 + 2 bullets ends 0.15 in above the limit. Puppeteer itself is not built yet (Phase 3), so re-check the fit there. Owner to confirm: the new lead-in sentence for `special_points` in the standard template, and "MoraSpirit's {{pillar_name}} operations" in the long one

- [x] **P1-19** Schema `default` values (`applyDefaults`), a validator for `schema.json` (`parseTemplateSchemaFile`), and QR variables in the render context (`qr` option) — needed by the templates and by Phase 5's import

## Phase 2 — Issuance app shell, auth and templates

- [x] **P2-01** Auth.js credentials provider with argon2id hashing
- [x] **P2-02** Session cookie settings (`HttpOnly`, `SameSite=Lax`, 8-hour expiry) and CSRF protection
- [x] **P2-03** Login rate limiting via `login_attempts` (5 per email+IP per 15 min) plus row purging
- [x] **P2-04** Generic login error messages (no account enumeration)
- [~] **P2-05** CLI script to create an admin account (`pnpm admin:create`, hidden password prompt) — written and type-checked but needs an interactive terminal, so it is **not yet run**: owner to run it once and tick this
- [x] **P2-06** Admin layout, navigation and a session guard on every route and API handler
- [x] **P2-07** `templates:publish` script with content hashing and version insertion
- [x] **P2-08** Template safety check in the publish script (no `<script>`, no inline handlers, no external URLs) wired into CI
- [x] **P2-09** Template list and version history screens (read-only)
- [x] **P2-10** Template preview rendered with sample data
- [~] **P2-11** — verified against a production build: every page redirects to /login and `/api/*` returns 401 when signed out; 5 failed logins then a correct password is refused (rows cleaned up afterwards); the block expiry is proven by the time-travel test; `templates:publish` twice = one version, one changed character = a second; a `<script>` template is rejected and nothing is written. Left open only until P2-05 is confirmed

## Phase 3 — Single certificate issuance and PDF

- [x] **P3-01** Auto-generated issuance form from the field schema (incl. a textarea for `list` fields)
- [x] **P3-02** Live client-side preview using the shared render package
- [x] **P3-03** Server-side validation via the generated zod schema
- [x] **P3-04** Rich-text sanitization at save time (strict allowlist, no attributes)
- [x] **P3-05** `dedupe_key` computation and the duplicate warning with "Issue anyway"
- [x] **P3-06** Transactional insert: `certificates` row + `created` audit row
- [x] **P3-07** Puppeteer service: reused browser, capped concurrency, per-render timeout
- [x] **P3-08** Puppeteer lockdown: JavaScript disabled, all non-`data:` requests aborted
- [x] **P3-09** QR generation for the verify URL, inlined as base64
- [x] **P3-10** Page options from the template (Letter, zero margin, `printBackground`) — via the template's `@page` CSS + `preferCSSPageSize`, size verified after rendering
- [x] **P3-11** One-page rule: measure height, verify page count with `pdf-lib`, fail with a clear message
- [x] **P3-12** PDF download route streaming the file; re-download re-renders from stored data
- [x] **P3-13** Tests: page count, page size, embedded font, QR target, audit row present
- [~] **P3-14** — all exit criteria verified against a production build with real HTTP requests: issue → 303 to the certificate; the PDF is one 612×792 pt page with selectable text and Liberation Serif embedded; the QR decodes to `VERIFY_BASE_URL/verify/{uuid}`; 40 long bullets fail with "Shorten 'Special Points'" and write nothing; identical output with the network blocked; exactly one `created` audit row per certificate. **Not yet checked by a person:** typing into the form and watching the live preview move, and the on-screen duplicate/overflow panels — owner to click through once (issue a fake certificate, download the PDF, look at it), then tick this

- [x] **P3-15** `/certificates/[id]` detail page (values, template version, status, history, download button) and dashboard/nav links — minimal; Phase 4 builds the list, edit and revoke on it

## Phase 4 — Certificate management

- [x] **P4-01** Certificate list with search by `member_id` and name, filters and pagination
- [x] **P4-02** Certificate detail page incl. template version and status
- [x] **P4-03** Edit flow with a required reason
- [x] **P4-04** Transactional edit writing old and new `data` to `certificate_audit`
- [x] **P4-05** Revoke with a required reason (`revoked_at`, `revocation_reason`, audit row)
- [x] **P4-06** Restore with an audit row
- [x] **P4-07** Audit history view on the detail page
- [x] **P4-08** Test proving no change path skips the audit log (`certificate-changes.test.ts` asserts the exact trail; `audit-guard.test.ts` fails if any file outside the two audited modules writes to `certificates`)
- [~] **P4-09** — verified: 48 issuance tests, plus 19 live HTTP checks against a production build (issue, list search and filters, prefilled edit, missing reason refused, stale form refused, history shows old → new with the reason, revoke, edit blocked while revoked, PDF still downloads, restore, trail is exactly created/edited/revoked/restored). Not yet clicked through by a person; owner to try the edit, revoke and restore screens once, then tick this

## Phase 5 — Bulk import (.xlsx / .csv)

- [x] **P5-01** Upload UI accepting `.xlsx` and `.csv` (`/imports/new`, template chosen per batch)
- [x] **P5-02** `.xlsx` parsing with SheetJS incl. a worksheet picker
- [x] **P5-03** `.csv` parsing with UTF-8 enforcement and BOM tolerance
- [x] **P5-04** Header matching (case/whitespace-insensitive), unknown columns reported, missing required columns fail
- [x] **P5-05** Cell trimming and `list` cell parsing
- [x] **P5-06** `Gender` → honorific mapping, with anything unrecognised failing the row
- [x] **P5-07** Date handling: real Excel date cells, plus `YYYY-MM-DD` and `DD/MM/YYYY` text
- [x] **P5-08** Row-by-row validation report; invalid rows block the import unless the admin ticks "Skip invalid rows" (decision changed from "all or nothing", see architecture §6 C step 14)
- [x] **P5-09** Duplicate file detection by `file_hash`
- [x] **P5-10** Per-row duplicate detection by `dedupe_key` (and repeats within the file), with Skip / Issue anyway
- [x] **P5-11** Transactional commit: `import_batches` + certificates + `created` audit rows
- [x] **P5-12** Batch list and batch detail pages
- [x] **P5-13** Real 39-row sheet analyzed end to end on a working copy with Pillar/Start date/End date columns added: 38 valid (22 General, 16 Special), SPL2510 rejected (gender and general points missing), no duplicates. Analysis only: the real people were not written to the dev database
- [x] **P5-14** Exit criteria verified by tests (`import.test.ts`): General/Special rows, re-upload warns before writing, bullets become list items with curly quotes intact
- [x] **P5-15** Migration `20260919180000_add_import_rejected_count`; every valid row is rendered as a one-page fit check
- [x] **P5-18** Failed rows as a table with a fix queue: the report lists rows that cannot be issued ("Rows to fix"); clicking one opens `/certificates/new?template=..&fix=..&row=..` in a new tab with the typed values prefilled, each field marked with what to correct, and a banner (Previous / Next / Skip). After issuing, the certificate page offers "Fix next failed row". The queue lives in the admin's own browser (localStorage, one-hour expiry, removed when every row is issued); nothing is stored on the server and no personal data is in a URL. Tests: `fix-queue.test.ts`, and typed values kept on failed rows in `import.test.ts` / `import-parse.test.ts`. Owner to click through once
- [~] **P5-16** Owner to click through `/imports/new` once with a fake spreadsheet (check, skip invalid, import, batch page), then tick this
- [x] **P5-17** Column guide and blank spreadsheet on `/imports/new`: under the template picker, a table of the chosen template's columns (required / optional / filled automatically, how to fill each, the missing-data rules) and a "Download blank spreadsheet" button (`GET /imports/template/{id}`, admin only). Both are generated from the template's field schema (`buildImportGuide` in `packages/shared`); a round-trip test feeds the generated workbook through the real importer for every template. Owner to look at it in the browser

## Phase 6 — Bulk ZIP export

- [x] **P6-01** Inngest wired in: `/api/inngest` (excluded from the session proxy), client, functions. Runs against the free local Dev Server (`INNGEST_DEV=1`); Cloud keys are a Phase 8 task (P8-15)
- [x] **P6-02** ZIP job: one step per certificate through the same render function, capped at 2 at a time, one ZIP job at once
- [x] **P6-03** Temp export folder `EXPORT_DIR/{batch_id}/` and atomic zipping (`.tmp` + rename), folder removed after the batch row is updated
- [x] **P6-04** Progress on the batch row (`zip_status`, `zip_rendered_count`) shown in the UI, polled every 2 s
- [x] **P6-05** Failure report in the new `zip_report` column (migration `20260920100000_add_import_zip_report`), incl. one-page-rule failures and revoked certificates; the rest still build
- [x] **P6-06** Admin-authenticated ZIP download route (`/imports/{id}/zip`); signed-out requests are redirected to login and never reach the file
- [x] **P6-07** Hourly cleanup cron deleting ZIPs and folders after 24 h and marking them `expired`; never follows a stored path
- [x] **P6-08** Crash/retry test: a job dying after 3 of 6 files, leaving partial files behind, then re-run, ends with 6 files and a complete ZIP; a failing ZIP build rejects cleanly and succeeds on retry (`zip-export.test.ts`)
- [x] **P6-09** Exit criteria verified: with the real Inngest Dev Server and real Chromium, a 3-certificate fake batch went generating -> ready in about 6 s and produced a valid ZIP of three one-page PDFs. The 39-certificate size was not run (would need real recipients or a large fake batch), so M3 is reached in logic and at small scale
- [x] **P6-10** Real bug found by the smoke test and fixed: the batch row is now updated before the PDF folder is removed, and a missing file fails the step instead of crashing the server
- [~] **P6-11** Owner to click through once: open an import batch, Generate ZIP, watch progress, download and open the ZIP, then tick this. Needs the Inngest Dev Server running: `npx inngest-cli dev -u http://localhost:3001/api/inngest`

## Phase 7 — Public verification app

- [x] **P7-01** Minimal Next.js app serving `/verify/[uuid]` only; the scaffold home page is gone and every other path is a plain 404
- [x] **P7-02** Prisma singleton on `verify_ro` with one connection per instance (`connectionLimit: 1`), created on first use
- [x] **P7-03** Node.js runtime, `force-dynamic`, `Cache-Control: no-store`; also `noindex` and `no-referrer`
- [x] **P7-04** UUID format check returning 404 before any query (proved by a test that the database client is never asked for)
- [x] **P7-05** Not-found state
- [x] **P7-06** Revoked state showing status and date only; the query never loads the data, template or reason
- [x] **P7-07** Active state: verified badge + `public_summary` fields only (rich text and lists never appear in the summary)
- [x] **P7-08** "View full certificate" as a `?full=1` link rendering into an `<iframe sandbox="" srcdoc>`; verified in real Chromium (Edge) at 390 px: letterhead, fonts and the real QR code load
- [x] **P7-09** Upstash rate limiting in `proxy.ts` (60/min/IP), failing open: unit-tested for allow, limit, error and timeout, and checked live against an unreachable Upstash URL (page still 200). The real Upstash call is only exercised after deployment (P8-16)
- [x] **P7-10** Mobile layout checked at 390 px in the browser pane (summary, revoked, not-valid) and in Edge (full letter, no horizontal scroll); a `zoom` breakpoint ladder covers 370 to 860 px
- [~] **P7-11** Independence: the verify process talks only to MySQL and has no URL or credential for the issuance app, and ran as its own process. The literal "issuance stopped" check was not done here (the owner's issuance dev server was running); repeat it once deployed
- [x] **P7-14** Owner's decision, 2026-09-26: the verify page opens on the full letter. `/verify/{uuid}` and `?full=1` are one page (verdict, summary rail, sandboxed letter); the summary-only view and both "View/Hide the full certificate" buttons are gone. Revoked and not-found are unchanged. `load-certificate.ts` always loads `html_content` for an active certificate; `verify-page.test.ts` updated (`?full=1` gives an identical page, revoked still leaks nothing). Supersedes the summary-first wording of P7-07 and P7-08. Owner to look at it on a phone
- [x] **P7-12** Test that a revoked certificate's content, member id and reason are absent from the HTML (`verify-page.test.ts`), also when `?full=1` is requested
- [~] **P7-13** Exit criteria verified except the phone scan of a real PDF's QR code, which needs the deployed public domain (dev QR codes point at `http://localhost:3001`) — **Milestone M2** is reached at Phase 8

## Phase U — Interface and design system

Cross-cutting, so it is lettered: the numeric `P8-xx` IDs referenced elsewhere keep
their meaning. Sequenced after Phase 7 and before Phase 8, so the apps are
deployed in the form people will actually use.

Strategy lives in `PRODUCT.md`; the visual system is documented in `DESIGN.md`.

- [x] **PU-01** `PRODUCT.md` — register, users, purpose, personality, anti-references, principles, accessibility target (WCAG 2.2 AA)
- [x] **PU-02** `packages/ui` — token stylesheet plus the primitives both apps share (`Button`, `Card`, `StatusPill`, `Banner`, `DescriptionList`, `EmptyState`, `Icon`); wired into both apps via `transpilePackages`
- [x] **PU-03** Palette anchored on the letterhead's own red (`#e73529`, sampled from `mora-letterhead-v1.jpg`), OKLCH throughout, neutrals tinted to hue 29
- [x] **PU-04** Every colour pairing verified against WCAG 2.2 AA before use, including control boundaries at 3:1 (SC 1.4.11); ratios recorded beside the tokens
- [x] **PU-05** Dark mode removed from both apps; one light theme to design and test
- [x] **PU-06** Inter via `next/font/google` in both apps, fixed rem type scale, system mono for IDs
- [x] **PU-07** Verify app rebuilt: valid, revoked, not-found and full-letter views. Documented wording kept verbatim ("Verified — Authentic", "This certificate has been revoked", "Not a valid certificate"), and the tuned `zoom` breakpoint ladder preserved
- [x] **PU-08** Admin shell: sticky top bar with active-destination marking, skip link, per-page action bar (`PageHeader`)
- [x] **PU-09** All 12 admin screens rebuilt — login, dashboard, certificate list / issue / detail / edit, imports list / new / batch, templates list / detail / version preview
- [x] **PU-10** Step rail on `/imports/new` only, where the sequence is real; the issue form stays one screen because the live preview depends on it
- [x] **PU-11** Revoke moved into a bordered danger zone with an outline button, so it can never be confused with the red-filled primary action
- [x] **PU-12** Empty states that teach the workflow, pending states on every submit, and `prefers-reduced-motion` honoured globally
- [x] **PU-13** No horizontal overflow at 360 / 390 / 768 / 1280 px on any screen in either app, checked in real Chromium
- [x] **PU-14** `DESIGN.md` written: tokens, type scale, component rules, motion, accessibility, and what the system deliberately does not do
- [x] **PU-15** Bug found and fixed during the pass: the Tailwind Prettier plugin strips leading spaces inside template-literal `className`s, fusing class names (`ms-field` + `ms-col-span` → `ms-fieldms-col-span`). All such call sites now use `cx()`; recorded in `DESIGN.md`
- [~] **PU-18** Whole-row click on list tables (certificates, templates, imports, import batch) via a stretched `.ms-cell-link`, plus a global `cursor: pointer` for enabled interactive elements. Built; owner to confirm in the browser
- [ ] **PU-16** Owner to click through both apps once and confirm the look, then tick this
- [ ] **PU-17** Exit criteria: `format:check`, `lint`, `typecheck`, `build` and all test suites pass; both apps render correctly at 360 px; `DESIGN.md` matches the code

## Phase 8 — Hardening, deployment and handover

- [ ] **P8-01** Dockerfile + compose with Chromium and fonts in the image
- [ ] **P8-02** Export volume and reverse proxy with HTTPS
- [ ] **P8-03** VPS provisioned and the issuance app deployed (D4)
- [ ] **P8-04** Vercel project, environment variables, function region, `verify.<domain>` domain
- [ ] **P8-05** Run the architecture §3 gate on PeekHosting (TLS, remote access, MySQL 8, `max_connections`, backups, privilege scoping, region)
- [ ] **P8-06** Decide the production database (D1) and record it in architecture §3
- [ ] **P8-07** Migrate to production; re-create `app_rw` and `verify_ro` there with `node scripts/create-db-users.js --print` (grants are environment-specific and are not part of the Prisma migrations)
- [ ] **P8-08** Automated off-site backups configured
- [ ] **P8-09** **Restore rehearsal completed** — restore an actual backup into a scratch database
- [ ] **P8-10** Security pass against architecture §9
- [ ] **P8-11** Load sanity check on the verify page, watching connection counts
- [ ] **P8-12** Operations runbook written (deploy, publish template, add asset, rotate credentials, restore, failed ZIP job)
- [ ] **P8-13** Fresh-checkout deployment test using only the runbook
- [ ] **P8-15** Create the Inngest Cloud account (free tier), copy its event key and signing key into the VPS environment (`INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`; never in the repo), remove `INNGEST_DEV`, point Inngest at `https://<admin-domain>/api/inngest`, and write the runbook entry
- [ ] **P8-16** Create the Upstash Redis database (free tier, region near the Vercel function region), set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` and `VERIFY_BASE_URL` in the Vercel project (never in the repo), then confirm a real 429 after 60 requests in a minute and that the page still works with Upstash blocked
- [ ] **P8-14** ✅ Exit criteria verified — **Milestone M4**, real issuance may begin

## Phase 9 — Post-launch (optional)

- [ ] **P9-01** Bulk revoke
- [ ] **P9-02** Export a batch's UUIDs/verify links for mail-merge
- [ ] **P9-03** Second signatory support
- [ ] **P9-04** Email delivery of letters to recipients
- [ ] **P9-05** Verification scan analytics
- [ ] **P9-06** Self-hosted Inngest
- [ ] **P9-07** Additional templates for other pillars

---

## Blocked / needs input

Record anything stalled here, with the date and what unblocks it.

| Date | Item | Blocked on | Owner |
|---|---|---|---|
| — | — | — | — |
