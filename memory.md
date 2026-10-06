# Memory — MoraSpirit Certificate System: templates, import fix queue, verify page, logo

Last updated: 2026-10-06

Phases 0–7 and Phase U (design system) are built. Nothing from this or the previous session is committed (the owner does all git work). Phase 8 (deployment) has not started.

## What was built

**Admin tables and chrome**
- Whole-row click on list tables via a stretched `.ms-cell-link` (in `apps/issuance/app/globals.css`); one global `cursor: pointer` rule for enabled interactive elements and row-header cell padding in `packages/ui/src/tokens.css`.
- Home page (`app/(admin)/page.tsx`) is now two letter cards (General Letter, Special Letter) with real thumbnails and **Issue one** / **Import spreadsheet** buttons. No recent-certificates list. `/imports/new?template=<id>` preselects the template.
- Templates and Issue pages use a shared `TemplateCard` (letter thumbnail, facts, action) in `app/_components/template-card.tsx`; facts come from `lib/template-facts.ts`. Templates page has no read-only banner.
- Bulk import overview page (`/imports`), template column guide on `/imports/new` (`column-guide.tsx`, `buildImportGuide` in `packages/shared/src/import-guide.ts`) and a blank-spreadsheet download `GET /imports/template/{id}` (`lib/import/template-workbook.ts`).
- **Fix queue** for failed import rows: `lib/fix-queue.ts`, `lib/use-fix-queue.ts`, failed-rows tables on the import report and batch page (below the certificates card), banner on the manual form, notice on the certificate page. Failed rows keep typed values in `AnalyzedRow.raw`.
- Friendly error pages: `app/error.tsx`, `app/(admin)/error.tsx`, `apps/verify/app/error.tsx`; login says "unavailable" instead of blaming the password when the DB is down.
- MoraSpirit logo in both navbars (`packages/certificate-assets/mora-logo-v1.png`, cropped from the letterhead; `.ms-logo` in tokens.css). Admin navbar: logo only, no "Certificates" word. Verify header: centred logo (6 rem), no nav, scrollbar hidden.
- List bullets are capitalized in `packages/certificate-render/src/render.ts` (`buildContext`).

**Templates (owner decision 2026-10-06):** exactly two, **General Letter** (`general-letter`, no `special_points` field) and **Special Letter** (`special-letter`, `special_points` required), one version each. Old folders, DB rows, 88 fake certificates and 7 batches were deleted from the dev DB. Seed pins its fake certificates to `general-letter`.

**Verify page (public):** went summary-first → full letter on the page (2026-09-26) → **details only (2026-10-06)**: heading "Online Verification Portal", a record card (name as heading, "Certificate of Employment" caption, Active pill, public_summary fields, issue date, check time in Sri Lanka time), contact line. No letter, iframe, bullets or signatory; `html_content` is no longer loaded; `render-full.ts` and `qrcode` dep removed. `?full=1` is the same page. Revoked / not-found pages unchanged. No "Verified — Authentic" badge any more.

**Other:** `packages/db/src/index.ts` now sets `connectTimeout: 10_000`, `acquireTimeout: 15_000`.

## Decisions made

- Verify page shows only public details; the owner accepted the privacy change and reversed it twice — `AGENTS.md` §6, `docs/architecture.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/TASKS.md` (P7-14/15/16) record it with dates.
- Fix queue lives only in the admin's browser (localStorage, 1 h expiry); nothing about rejected rows is stored on the server. A fixed row becomes an ordinary manual certificate (no batch link, not in the batch ZIP).
- One spreadsheet format per template; the old combined sheet's "Letter type" column is ignored.
- Wording of both letters unchanged from the earlier standard / outstanding templates; templates and assets remain immutable and developer-authored.

## Problems solved

- **"pool timeout … active=0 idle=0"**: the `mariadb` driver's default `connectTimeout` is 1 s; the Aiven dev DB is ~0.6 s per round trip. Fixed with longer timeouts. Restart dev servers after changing it.
- Shell heredocs with mixed quotes broke (`unexpected EOF`); write Python patch scripts to the scratchpad instead. `python3` does not exist here, use `python`.
- Several files use CRLF; patch scripts normalise line endings. Prisma transactions over the remote DB need `{ timeout: 60000 }`.
- Running `pnpm build` while dev servers run can make the dev pages render half-loaded; reload.
- The in-app browser screenshot often times out; use `javascript_tool` measurements instead.

## Current state

- `format:check`, `lint`, `typecheck`, `build` pass. Verify 17 tests, shared 46, templates 46, render 24, issuance import/fix-queue/workbook/render-pdf tests pass in isolation. The full issuance suite has still never been seen green in one run (stop dev servers first).
- Dev DB: two templates (v1 each), one admin (`admin@moraspirit.test`), no certificates. `pnpm db:seed` would add fake ones.
- Not seen by a person / unverified: the issue-app navbar with the logo, home page cards, import fix queue click-through, verify page at the latest size (logo 6 rem, no scrollbar).
- Unticked tasks: P2-05, P3-14, P4-09, P5-16, P6-11, PU-16, PU-17 (owner click-throughs) and all of Phase 8.

## Next session starts with

Stop both dev servers and run `pnpm --filter issuance test` end to end. Then the owner reviews the verify page, home page and navbars in a browser; commit (suggested message in the last turn: "Verify page: larger logo, tighter spacing, no scrollbar track" plus the earlier unreleased changes) or start Phase 8.

## Open questions

- Logo is a soft JPEG crop; a transparent SVG/PNG from MoraSpirit would replace it as `mora-logo-v2`.
- "Certificate of Employment" caption on the verify card is hardcoded; it should come from the template if non-employment templates are added.
- Inngest local dev server is needed for ZIP export (`INNGEST_DEV=1` plus `npx inngest-cli dev -u http://localhost:3000/api/inngest`).
- Still open from before: D1 production database (PeekHosting gate), D4 VPS region, D6 Prisma 7.10.0 pin, final public verify domain (printed QR codes cannot change), MoraSpirit confirming the two template wordings, the long letter's ~0.15 in page headroom, no watchdog for a stuck ZIP batch, certificate detail page shows raw ISO dates.
