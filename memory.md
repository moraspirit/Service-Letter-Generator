# Memory — MoraSpirit Certificate System: Phases 5–7 built (bulk import, ZIP export, verify app)

Last updated: 2026-09-20

## What was built

Phases 0–7 are built. Docs (`docs/architecture.md` = source of truth, `docs/TASKS.md` = tracker, `AGENTS.md` = rules) are kept in step with the code and hold the detail; earlier phases (0–4: render core, auth/templates, issuance + PDF, certificate management) are described there. This session:

- **Phase 5 – bulk import.** `packages/shared/src/import-parse.ts` (header matching by label or name, `Gender` → honorific, `YYYY-MM-DD` / `DD/MM/YYYY` dates, `convertRow`). `apps/issuance/lib/import/` (`read-file.ts` xlsx via SheetJS + csv via papaparse, `analyze-import.ts`, `commit-import.ts`), pages `/imports`, `/imports/new`, `/imports/[id]`. Migration `20260919180000_add_import_rejected_count`. `commit-import.ts` is an allowed writer in `test/audit-guard.test.ts`.
- **Phase 6 – ZIP export.** `apps/issuance/lib/export/` (plain functions: `requestExport`, `renderCertificateToFile`, `finalizeExport`, `cleanupExpired`, safe paths derived from batch id), `lib/inngest/` (client + thin functions + hourly cleanup cron), `/api/inngest` (excluded from the session proxy), ZIP panel on the batch page, admin-only `GET /imports/[id]/zip`. Migration `20260920100000_add_import_zip_report`.
- **Phase 7 – verify app.** `apps/verify`: only `/verify/[uuid]` + `proxy.ts` rate limit. `lib/` (`db.ts` one `verify_ro` connection, `load-certificate.ts`, `summary.ts`, `render-full.ts`, `rate-limit.ts`, `uuid.ts`), 17 tests (`test/`). Scaffold page removed.

## Decisions made

- Invalid import rows block the commit unless the admin ticks "Skip invalid rows" (changed from all-or-nothing; architecture §6 C step 14 updated). `pillar_name`, `start_date`, `end_date` must be **columns in the sheet** (the real sample sheet has none; add them to a working copy). Import is two steps with no server-side session: Check, then Import re-uploads the file and the server re-runs the whole analysis (fit check included). Every valid row is rendered as a one-page fit check (twice: check + import).
- ZIP: `zip_report` JSON column (certificate id, member id, generic reason; never names) survives expiry. Only active certificates are exported; revoked ones are listed in the report. Steps return only ids and generic reasons because Inngest stores step results. Batch row is updated to `ready` before the PDF folder is deleted. Regenerate is refused while queued/generating. Inngest runs on the free local Dev Server in dev (`INNGEST_DEV=1`); Cloud account/keys only in Phase 8 (P8-15).
- Verify: "View full certificate" is a plain `?full=1` link rendered server-side (letter never in the summary page source); iframe `sandbox=""`; revoked certificates are answered from the status row only; malformed UUID = 404 with no query; rate limit fails open (500 ms timeout), off when Upstash vars unset. `zoom` breakpoints fit the letter on phones.
- `pnpm-workspace.yaml`: `protobufjs: false` (inngest dependency install script denied). SheetJS is installed from the vendor CDN tarball (npm `xlsx` is stale/vulnerable).

## Problems solved

- Bash heredocs break on curly quotes/apostrophes/backticks: use the Write/Edit tools for such files (a BOM char in a test also tripped lint; use `String.fromCharCode(0xfeff)`).
- A `tsx` script that opens Chromium never exits: add `process.exit`; and `| tail` hides output until exit.
- A running `next dev` keeps a stale Prisma client after `prisma generate`; restart it. `pnpm` root scripts fail with `ERR_PNPM_IGNORED_BUILDS` until new deps' install scripts are set in `pnpm-workspace.yaml`. When pnpm is broken, run `npx prisma migrate deploy` / `generate` inside `packages/db`.
- An Inngest function with `concurrency: 1` stays blocked by an earlier stuck run; restarting the dev server clears it.
- The in-app browser pane does NOT load subresources inside `sandbox=""` iframes (letterhead looks blank); real Edge renders it fine (checked with puppeteer-core + Edge).
- Dev port clash: the issuance dev server may sit on 3001, which is the verify app's port and the dev QR target (`VERIFY_BASE_URL=http://localhost:3001`).

## Current state

- All automated checks pass: `format:check`, `lint`, `typecheck`, `build`; issuance 73 tests, verify 17, shared 39+ (issuance not re-run after Phase 7, untouched). Phases 5 and 6 were committed by the owner; Phase 7 was uncommitted at last check.
- Verified live: import analysis of the real 39-row sheet (working copy with 3 columns added; 38 valid, SPL2510 rejected; not written to the DB), ZIP through the real Inngest Dev Server + Chromium (3 fake letters, valid ZIP), verify page over HTTP and in Edge at 390 px, fail-open with an unreachable Upstash.
- **Owner checks still open** (owner said they will do them after all phases): P2-05 (`pnpm admin:create`), P3-14, P4-09, P5-16, P6-11 (needs `npx inngest-cli dev -u http://localhost:3001/api/inngest` and a restarted dev server). Not verified: a 39-certificate ZIP, "issuance stopped" independence check (P7-11), phone scan of a real PDF (P7-13, needs the deployed domain), real Upstash 429 (P8-16).
- Phase 8 and 9 not started. Dev DB (Aiven) holds seed data and both templates; test rows are cleaned up.

## Next session starts with

Run `/architect` on **Phase 8 — hardening, deployment and handover** (Dockerfile + Chromium, VPS, Vercel project, production database decision against architecture §3 gate, backups + restore rehearsal, security pass, load check, runbook). It needs the owner's input on D1 and D4 first. Remember the Phase 8 tasks added this session: P8-15 (Inngest Cloud account/keys) and P8-16 (Upstash account/keys, `VERIFY_BASE_URL` on Vercel).

## Open questions

- D1 production database (PeekHosting must pass the §3 gate), D4 VPS provider/region, D6 Prisma pinned at 7.10.0 (8 is RC).
- Final public verify domain: printed QR codes cannot change, so decide before real issuance.
- MoraSpirit should confirm two wordings I invented in the templates (the `special_points` lead-in "made the following notable contributions" and "MoraSpirit's {{pillar_name}} operations"); the sample PDF says "Special Project Pillar" but the sheet says "Special Projects Pillar".
- The long-wording letter has only ~0.15 in of headroom; recheck fit in Docker/Chromium. Phase 8 notes: proxy must overwrite `X-Forwarded-For`, set `AUTH_URL`/HTTPS for a `Secure` cookie, Dockerfile needs Chromium + `CHROMIUM_PATH`, remove `INNGEST_DEV` in production.
- A batch can stay `generating` if the app server dies and never returns (no watchdog).
