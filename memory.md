# Memory — MoraSpirit Certificate System: Phases 1–4 built

Last updated: 2026-09-19

## What was built

Phases 0–4 are built. Docs (`docs/architecture.md` = source of truth, `docs/TASKS.md` = tracker, `AGENTS.md` = rules) were kept in step with the code and hold the detail; this lists the shape.

- **Phase 1 – render core.** `packages/shared` (FieldSchema types, zod generator, `parseListCell`, `applyDefaults`, `parseTemplateSchemaFile`, `dataFromRawValues`/`validateCertificateData`, `plainTextToRichText`/`richTextToPlainText`, `sampleDataFromSchema`). `packages/certificate-render` (one Handlebars instance, pronouns from honorific, `verb`/`formatDate` helpers, `renderCertificateHtml`, asset resolver; `/node` export builds data-URI resolver). `packages/certificate-assets` (`mora-letterhead-v1.jpg` from the current PDF, Liberation Serif 2.1.5 WOFF2 ×4 unsubset + OFL licence, `sync.mjs` copying into both apps' `public/certificate-assets` on predev/prebuild). `packages/certificate-templates` (`moraspirit-service-letter` = standard wording, `moraspirit-service-letter-outstanding` = long wording; each has `template.hbs`, `schema.json`, `sample.json`; `checkTemplateSafety`, content hash).
- **Phase 2 – auth + templates.** `apps/issuance`: Auth.js v5 (beta.32) credentials, JWT session 8 h; `proxy.ts` + `requireAdmin()`/`requireAdminApi()` two-layer guard; login throttling in `login_attempts` (5 per email+IP / 15 min); `pnpm admin:create` (hidden prompt); `pnpm templates:publish`; read-only template list/history/preview. `packages/db/src` runtime client factory. Migration `20260919160000_add_template_slug` applied to Aiven dev.
- **Phase 3 – issue + PDF.** Schema-driven form with live preview (`certificates/_components/certificate-form.tsx`), `lib/issue-certificate.ts` (validate → sanitize → duplicate warning → real render as fit check → one transaction: certificate + `created` audit), `lib/pdf/` (puppeteer-core on installed Edge/Chrome, JS off, only `data:` allowed, one-page rule via `#letter-body`/`#letter-end` markers + pdf-lib page check), QR via `qrcode`, `/certificates/[id]/pdf` download, `/certificates/[id]` detail.
- **Phase 4 – management.** `lib/certificate-changes.ts` (edit with reason + optimistic lock on `updatedAt`, revoke, restore), `lib/certificate-list.ts` (raw-SQL case-insensitive search, filters, 25/page), `lib/audit-diff.ts`, `/certificates` list, `/certificates/[id]/edit`, revoke/restore forms and history on the detail page. `test/audit-guard.test.ts` fails if any file besides `issue-certificate.ts`/`certificate-changes.ts` writes to `certificates`.

## Decisions made

- D2: **Liberation Serif** (fonts shipped unsubset because the OFL reserves the name "Liberation"). D3: **two templates** (MoraSpirit confirmed the long wording is still used). D5: keep Next's generated `AGENTS.md`/`CLAUDE.md`.
- Page setup comes from each template's `@page` CSS (`preferCSSPageSize`), not `schema.json`; page checked to be exactly 612×792 pt after rendering.
- One-page check runs **before** the issue/edit transaction commits, and again on every download. Field named in the error = the list/richtext field with the most text.
- Chromium from an installed browser (`CHROMIUM_PATH` or auto-detect), no download; `CHROMIUM_NO_SANDBOX=1` only for a root container (Phase 8).
- QR = `VERIFY_BASE_URL/verify/{uuid}`; in production `VERIFY_BASE_URL` must be explicit https on a public host, else rendering/issuing refuses.
- Rich text is entered as plain text (blank line = paragraph), escaped, converted, then sanitized (`p br strong em ul ol li`, no attributes).
- Edit uses the certificate's **pinned** template version; revoked certificates can't be edited; no-op edits refused; PDF of a revoked certificate still downloads.
- Login IP = first `X-Forwarded-For` entry (only safe behind our own reverse proxy: Phase 8).
- Letterhead was taken from the **current PDF** (the .docx copies carry outdated contact names). The old header/footer slices were deleted.
- Templates are Prettier-ignored (`*.hbs` in `.prettierignore`); they must start with `<!doctype html>`.

## Problems solved

- Prettier reflowed `.hbs` files and dropped `<!doctype html>` → ignore `*.hbs`; **never run `npx prettier --write packages` from a subfolder** (`.prettierignore` is read from cwd).
- Tool/heredoc quirks: backslashes in Bash/Python heredocs get mangled (a `\b` regex became a backspace byte) and odd-looking quotes can make a whole heredoc fail. Use the Write/Edit tools or `String.raw` for anything with backslashes.
- `tsx` scripts in `apps/issuance` (CommonJS) can't use top-level await → wrap in `main()`.
- Auth.js session cookie is HttpOnly, so curl's cookie jar prefixes it `#HttpOnly_`; strip that prefix before reusing the jar in Python. Port 3000 is often taken by an unrelated process; use 3010 for test servers.
- Chromium `--proxy-server=127.0.0.1:1` (via `CHROMIUM_EXTRA_ARGS`) is how the "network cut" test proves nothing is fetched at render time.
- Never `git mv` (it stages). It happened once and was undone with `git restore --staged`.
- A live check of server actions is possible without a browser: POST multipart with the form's hidden `$ACTION_*` inputs (see how Phase 3/4 checks were done).

## Current state

- `pnpm test` (all packages incl. ~48 issuance tests against Aiven), `lint`, `typecheck`, `format:check`, `build` all pass. The 19 live HTTP checks for Phase 4 and the Phase 3 exit checks passed against a production build.
- Dev DB (Aiven MySQL, db `mora-spirit`, users `app_rw`/`verify_ro`) holds seed data plus both templates published at v2; test certificates were cleaned up. Dev admin: `admin@moraspirit.test` (password lives in the seed script, dev only). Aiven free plan powers off when idle.
- **Awaiting owner:** P2-05 (run `pnpm admin:create` once), P3-14 and P4-09 (click through the UI once: issue, live preview, download PDF, edit, revoke, restore). Everything is uncommitted — the owner does all git operations. Suggested commit messages were given per phase.
- Phases 5–9 not started. `apps/verify` is still the untouched scaffold.

## Next session starts with

Run `/architect` on **Phase 5 — bulk import (.xlsx/.csv)**. Read `docs/samples/Special Projects Pillar'25 service letters.xlsx` first (columns: Member ID, Name, Gender, Letter type, General Points, Special Points; 39 rows; SPL2510 must be rejected with a reason; `Gender` Male/Female → Mr./Ms.; list cells use a U+2022 bullet + blank-line separators). Signatory fields come from schema `default`s; the importer must omit blank cells (not send `""`) for date/select fields. Import must also choose a template (standard vs outstanding wording) per batch, use `import_batches`, duplicate file hash and per-row dedupe warnings (Skip / Issue anyway), and one transaction for batch + certificates + audit rows. Also decide whether each imported row needs the one-page fit check (bulk render cost).

## Open questions

- D1 production database (PeekHosting must pass the architecture §3 gate) and D4 VPS region — Phase 8. D6 Prisma pinned at 7.10.0 (8 is RC) — Phase 8.
- Final public verify domain: printed QR codes can't change, so it must be decided before real issuance (dev uses `http://localhost:3001`).
- MoraSpirit should confirm two wordings I invented: the lead-in sentence before `special_points` in the standard template ("made the following notable contributions") and "MoraSpirit's {{pillar_name}} operations" in the long template. The sample PDF says "Special Project Pillar" while the spreadsheet says "Special Projects Pillar" (data, not template).
- The long-wording letter with 3 general + 2 special bullets ends only ~0.15 in above the page limit; recheck fit in Docker/Chromium in Phase 8.
- Phase 8 items noted along the way: reverse proxy must overwrite `X-Forwarded-For`; set `AUTH_URL`/HTTPS so the session cookie is `Secure`; Dockerfile needs Chromium + `CHROMIUM_PATH`.
