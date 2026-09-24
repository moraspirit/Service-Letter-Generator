# Memory — MoraSpirit Certificate System: Phase U (design system across both apps)

Last updated: 2026-09-24

## What was built

Phases 0–7 were already complete and are committed (see `docs/TASKS.md` and `docs/architecture.md` for that detail). This session added **Phase U — interface and design system**, which is **uncommitted**.

- **`packages/ui`** (new workspace package): `src/tokens.css` (all tokens + `ms-*` component classes), `src/icon.tsx` (one inline SVG set), `src/primitives.tsx` (`Button`, `LinkButton`, `Card`/`CardHead`/`CardBody`, `StatusPill`, `CertificateStatusPill`, `Banner`, `DescriptionList`, `EmptyState`, `cx`), `src/index.ts`. Wired into both apps via `workspace:*` + `transpilePackages`.
- **All 14 screens rebuilt.** Issuance: login, dashboard, certificate list / new / detail / edit, imports list / new / batch, templates list / detail / version preview, plus `app/(admin)/layout.tsx` and new `app/_components/` (`page-header.tsx`, `nav-link.tsx`). Verify: `/verify/[uuid]` three states, `not-found.tsx`, new `verdict.tsx`; old `verify/[uuid]/icons.tsx` deleted.
- **Both `globals.css` rewritten**; dark mode removed from both apps; Inter via `next/font/google` in both root layouts.
- **`PRODUCT.md`** and **`DESIGN.md`** written at the repo root. `docs/TASKS.md` gained **Phase U** (`PU-01`…`PU-17`). `AGENTS.md` gained design-system rules and a pointer to the two new docs.
- **Verify full-certificate view (`?full=1`) rebuilt as two columns** — summary rail left, letter right — fixing a horizontal scrollbar.

## Decisions made

- **Brand colour is sampled, not chosen**: `#e73529` = `oklch(60.7% 0.215 29)`, taken from `packages/certificate-assets/mora-letterhead-v1.jpg` (charcoal `#414141` alongside it). Neutrals are tinted to hue 29. OKLCH throughout.
- **Red does two jobs, separated by shape**: primary actions are a solid red fill; destructive actions are a red **outline** inside a bordered danger zone. Never a red fill for destructive.
- **Light theme only.** Do not reintroduce `prefers-color-scheme`.
- **`packages/ui` uses plain CSS component classes, not Tailwind utilities** — neither app's Tailwind scans that package, so utilities there silently do nothing. Tailwind utilities are for page-level layout inside an app only.
- **Top bar, not a sidebar** for the admin (four destinations; tables want the width), plus a per-page action bar (`PageHeader`).
- **Step rail only on `/imports/new`**, where the sequence is real. The issue form stays one screen because the live preview depends on it.
- **Verify shell widens to 78rem only on the full view**, via `:has(.ms-full)`; everything else keeps the 46rem reading column (`.ms-verify-col`). Consistent with the codebase already requiring OKLCH.
- Verify page **wording is pinned by `docs/architecture.md`** and was kept verbatim: "Verified — Authentic", "This certificate has been revoked", "Not a valid certificate".
- Accessibility target **WCAG 2.2 AA**, verified with computed ratios (recorded beside the tokens), including 3:1 control boundaries (SC 1.4.11).

## Problems solved

- **The Tailwind Prettier plugin strips leading spaces inside template-literal `className`s**, silently fusing names (`ms-field` + `" ms-col-span"` → `ms-fieldms-col-span`). Two real bugs came from this. Always use `cx()`. Recorded in `DESIGN.md` and `AGENTS.md`.
- **Tailwind's CSS resolver does not consult a package's `exports` map** — `@import "@moraspirit/ui/tokens.css"` fails under Turbopack. Both apps import it workspace-relative: `@import "../../../packages/ui/src/tokens.css"`.
- **Tailwind preflight removes list markers**, so `.ms-bullets` / `.ms-dup-list` set `list-style: disc` explicitly.
- **The verify full view scrolled sideways**: the letter is a fixed 816px page but the column was 46rem (736px), and the `zoom` ladder only started at 860px. Fixed by widening the shell on that view and adding desktop zoom steps (0.78 / 0.88 / 1 at 64 / 70 / 78rem).
- **A `DescriptionList` in a narrow rail breaks words** ("26th of Septem/ber") because `.ms-dl`'s two-column grid keys off viewport, not container. Rails stack terms above values (`.ms-dl-stack` in issuance, `.ms-full-side .ms-dl` in verify).
- **The in-app browser pane renders unreliably here** and cannot load subresources inside `sandbox=""` iframes. Use `puppeteer-core` + Edge for all visual checks; a screenshot/overflow harness pattern is in the scratchpad.
- **Git Bash (MSYS) rewrites leading-slash script arguments** into Windows paths — pass route paths without the leading slash and add it in the script.
- `@moraspirit/db` exports **`getPrisma()`**, not a `prisma` const.
- Running the whole issuance suite while both dev servers are up exhausts the Aiven free-tier connection pool (`pool timeout`); the same files pass in isolation.

## Current state

- `format:check`, `lint`, `typecheck` and `build` all pass. Verify 17/17, shared 39, templates 44, render 23 — all pass.
- **Not verified:** the issuance suite has never been seen green end-to-end in a single run this session. Two files failed on `pool timeout` (connection contention, not a code fault) and passed when run alone (13/13). Re-run with the dev servers stopped.
- Visual checks done in real Chromium: both apps at 360 / 390 / 768 / 1280 px with **no horizontal overflow anywhere**, and the verify full view at 14 widths from 360 to 1600 px with no scrollbar.
- Nothing is committed. `git status` shows the Phase U changes plus untracked `PRODUCT.md`, `DESIGN.md`, `packages/ui/`, `apps/issuance/app/_components/`, `apps/verify/app/verify/[uuid]/verdict.tsx`.
- Dev servers were running on **3000 (issuance)** and **3001 (verify)** — both started by the owner, not by the agent.

## Next session starts with

Stop both dev servers, run `pnpm --filter issuance test` and confirm it passes end to end. Then either commit Phase U (a suggested message was given: "Phase U: one light design system across both apps, anchored on the letterhead red") or continue to **Phase 8 — hardening, deployment and handover**, which still needs the owner's input on D1 and D4 first.

`PU-16` (owner clicks through both apps) and `PU-17` (exit criteria) are the only unticked Phase U tasks.

## Open questions

- **Fixture templates — unresolved.** The owner asked about removing "Service letter (fixture)" and "Fixture e783bd1a" from the issue picker, then dismissed the options, so nothing was changed. Findings: `Fixture e783bd1a` (id 60, slug `test-fixture-e783bd1a`) is **test litter** from `apps/issuance/test/fixtures.ts` whose `cleanup()` did not run after a failed run — it leaked 11 certificates and an orphan admin user, and will recur. `Service letter (fixture)` (id 3, slug `template-3`) is **seed data**, recreated by every `pnpm db:seed`, so deleting rows will not stick. Neither reaches production, since Phase 8 migrates to a fresh database. Note the seed script writes slug `fixture-service-letter` but the row has `template-3`, so that row predates the current seed.
- Admin certificate detail shows raw ISO dates (`2025-04-28`) rather than the letter's "28th of April 2025" — deliberate for a record view, but the owner may want them to match.
- A newer Impeccable skill is available (`npx impeccable update`, applies to the next session).
- Carried forward and still open: **D1** production database (PeekHosting must pass the architecture §3 gate), **D4** VPS provider/region, **D6** Prisma pinned at 7.10.0. The final public verify domain must be decided before real issuance, because printed QR codes cannot change. MoraSpirit should still confirm the two template wordings invented in Phase 1. The long-wording letter has only ~0.15 in of headroom — recheck the fit in Docker/Chromium. A ZIP batch can stay `generating` forever if the app server dies (no watchdog).
