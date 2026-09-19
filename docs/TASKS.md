# Task Tracker — MoraSpirit Certificate & Verification System

Progress tracker for [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md). Architecture decisions live in [architecture.md](architecture.md).

**How to use:** tick a task only when it works against the Aiven test database and its phase's exit criteria still pass. Update the status table when a phase starts or finishes. Add new tasks at the end of their phase, keeping the ID sequence.

**Status key:** `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked (add a note)

---

## Progress at a glance

| Phase | Scope | Status | Notes |
|---|---|---|---|
| 0 | Foundations | ✅ Complete | All of P0-01→P0-12 done |
| 1 | Shared rendering core | 🔄 In progress | P1-01→P1-10 done (render core). P1-11 done. Next: font, asset copy step, two templates (P1-12→P1-18). |
| 2 | App shell, auth, templates | ⬜ Not started | |
| 3 | Single issuance + PDF | ⬜ Not started | The core loop |
| 4 | Certificate management | ⬜ Not started | |
| 5 | Bulk import | ⬜ Not started | |
| 6 | Bulk ZIP export | ⬜ Not started | |
| 7 | Verification app | ⬜ Not started | |
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
| D5 | Next.js 16 writes its own `AGENTS.md` / `CLAUDE.md` into each app on `next dev` and re-adds them if deleted. Currently kept, with a pointer appended to the root rules. Confirm this is acceptable or decide on a suppression approach | ⏳ Open | Phase 2 |

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
- [x] **P0-11** Seed script (`pnpm db:seed`, also run by `prisma migrate reset`): one admin user, a template with two versions, an import batch, and four fabricated certificates (one pinned to the older version, one revoked) with their audit rows
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
- [x] **P1-11** Extract the letterhead image from the samples into `packages/certificate-assets` (cut into `mora-header-v1.jpg` + `mora-footer-v1.jpg`; see the package README for why)
- [ ] **P1-12** Choose and add the font files (D2), with licences recorded in the package README
- [ ] **P1-13** Build step copying assets into both apps' `public/certificate-assets/`
- [ ] **P1-14** Author `moraspirit-service-letter/template.hbs` — US Letter, full-bleed letterhead, US spelling, QR placeholder
- [ ] **P1-15** Author its `schema.json` with the field set from architecture §5
- [ ] **P1-16** Pronoun tests for all three honorifics, including the "Ms. … he pursues" case
- [ ] **P1-18** Author the second template (long "outstanding contributions" wording) with its own `schema.json` — decision D3
- [ ] **P1-17** ✅ Exit criteria verified (sample letter reproduced; General letter omits the special section)

## Phase 2 — Issuance app shell, auth and templates

- [ ] **P2-01** Auth.js credentials provider with argon2id hashing
- [ ] **P2-02** Session cookie settings (`HttpOnly`, `SameSite=Lax`, 8-hour expiry) and CSRF protection
- [ ] **P2-03** Login rate limiting via `login_attempts` (5 per email+IP per 15 min) plus row purging
- [ ] **P2-04** Generic login error messages (no account enumeration)
- [ ] **P2-05** CLI script to create an admin account
- [ ] **P2-06** Admin layout, navigation and a session guard on every route and API handler
- [ ] **P2-07** `templates:publish` script with content hashing and version insertion
- [ ] **P2-08** Template safety check in the publish script (no `<script>`, no inline handlers, no external URLs) wired into CI
- [ ] **P2-09** Template list and version history screens (read-only)
- [ ] **P2-10** Template preview rendered with sample data
- [ ] **P2-11** ✅ Exit criteria verified (auth guards, lockout, idempotent publish, unsafe template rejected)

## Phase 3 — Single certificate issuance and PDF

- [ ] **P3-01** Auto-generated issuance form from the field schema (incl. a textarea for `list` fields)
- [ ] **P3-02** Live client-side preview using the shared render package
- [ ] **P3-03** Server-side validation via the generated zod schema
- [ ] **P3-04** Rich-text sanitization at save time (strict allowlist, no attributes)
- [ ] **P3-05** `dedupe_key` computation and the duplicate warning with "Issue anyway"
- [ ] **P3-06** Transactional insert: `certificates` row + `created` audit row
- [ ] **P3-07** Puppeteer service: reused browser, capped concurrency, per-render timeout
- [ ] **P3-08** Puppeteer lockdown: JavaScript disabled, all non-`data:` requests aborted
- [ ] **P3-09** QR generation for the verify URL, inlined as base64
- [ ] **P3-10** Page options from the template (Letter, zero margin, `printBackground`)
- [ ] **P3-11** One-page rule: measure height, verify page count with `pdf-lib`, fail with a clear message
- [ ] **P3-12** PDF download route streaming the file; re-download re-renders from stored data
- [ ] **P3-13** Tests: page count, page size, embedded font, QR target, audit row present
- [ ] **P3-14** ✅ Exit criteria verified — **Milestone M1**

## Phase 4 — Certificate management

- [ ] **P4-01** Certificate list with search by `member_id` and name, filters and pagination
- [ ] **P4-02** Certificate detail page incl. template version and status
- [ ] **P4-03** Edit flow with a required reason
- [ ] **P4-04** Transactional edit writing old and new `data` to `certificate_audit`
- [ ] **P4-05** Revoke with a required reason (`revoked_at`, `revocation_reason`, audit row)
- [ ] **P4-06** Restore with an audit row
- [ ] **P4-07** Audit history view on the detail page
- [ ] **P4-08** Test proving no change path skips the audit log
- [ ] **P4-09** ✅ Exit criteria verified (audit always written; template version unchanged by edits)

## Phase 5 — Bulk import (.xlsx / .csv)

- [ ] **P5-01** Upload UI accepting `.xlsx` and `.csv`
- [ ] **P5-02** `.xlsx` parsing with SheetJS incl. a worksheet picker
- [ ] **P5-03** `.csv` parsing with UTF-8 enforcement and BOM tolerance
- [ ] **P5-04** Header matching (case/whitespace-insensitive), unknown columns reported, missing required columns fail
- [ ] **P5-05** Cell trimming and `list` cell parsing
- [ ] **P5-06** `Gender` → honorific mapping, with anything unrecognised failing the row
- [ ] **P5-07** Date handling: real Excel date cells, plus `YYYY-MM-DD` and `DD/MM/YYYY` text
- [ ] **P5-08** Row-by-row validation report; nothing committed until all rows pass
- [ ] **P5-09** Duplicate file detection by `file_hash`
- [ ] **P5-10** Per-row duplicate detection by `dedupe_key`, with Skip / Issue anyway
- [ ] **P5-11** Transactional commit: `import_batches` + certificates + `created` audit rows
- [ ] **P5-12** Batch list and batch detail pages
- [ ] **P5-13** Import the real 39-row sheet end to end; confirm SPL2510 is rejected with a reason
- [ ] **P5-14** ✅ Exit criteria verified (bullets become list items; re-upload warns; quotes intact)

## Phase 6 — Bulk ZIP export

- [ ] **P6-01** Inngest wired in (`/api/inngest`, signing key, Cloud free tier)
- [ ] **P6-02** ZIP job with one step per certificate and capped Puppeteer concurrency
- [ ] **P6-03** Temp export volume `/data/tmp-exports/{batch_id}/` and zipping
- [ ] **P6-04** Progress on the batch row (`zip_status`, `zip_rendered_count`) shown in the UI
- [ ] **P6-05** Failure report listing certificates that could not render (incl. one-page-rule failures)
- [ ] **P6-06** Admin-authenticated ZIP download route (never a public path)
- [ ] **P6-07** Cleanup cron deleting ZIPs after 24 h and marking them `expired`
- [ ] **P6-08** Retry/interruption test proving no duplicate or corrupt output
- [ ] **P6-09** ✅ Exit criteria verified — **Milestone M3**

## Phase 7 — Public verification app

- [ ] **P7-01** Minimal Next.js app serving `/verify/[uuid]` only
- [ ] **P7-02** Prisma singleton on `verify_ro` with `connection_limit=1` and a low pool timeout
- [ ] **P7-03** Node.js runtime, `force-dynamic`, `Cache-Control: no-store`
- [ ] **P7-04** UUID format check returning 404 before any query
- [ ] **P7-05** Not-found state
- [ ] **P7-06** Revoked state showing status and date only
- [ ] **P7-07** Active state: verified badge + `public_summary` fields only
- [ ] **P7-08** "View full certificate" rendering into a sandboxed `<iframe srcdoc>` without `allow-scripts`
- [ ] **P7-09** Upstash Redis rate limiting in middleware (60/min/IP), failing open
- [ ] **P7-10** Mobile layout check — most visitors arrive from a phone camera
- [ ] **P7-11** Test with the VPS stopped, proving independence
- [ ] **P7-12** Test that a revoked certificate's content is absent from the HTML source
- [ ] **P7-13** ✅ Exit criteria verified — **Milestone M2**

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
