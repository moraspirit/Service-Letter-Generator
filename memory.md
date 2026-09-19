# Memory — MoraSpirit Certificate System: planning through Phase 0

Last updated: 2026-09-19

## What was built

**Documentation (`docs/`)** — all written this session, from scratch:

- `architecture.md` — reviewed and rewritten via ~18 decision questions. Source of truth.
- `IMPLEMENTATION_PLAN.md` — 9 phases, each with build list and exit criteria.
- `TASKS.md` — ~110 numbered tasks (P0-01 … P9-07), milestones, open decisions D1–D7.
- `README.md` (docs index), root `README.md`, `AGENTS.md` (canonical rules), `CLAUDE.md`.
- `docs/samples/` — the four real MoraSpirit files (2 .docx, 1 .xlsx, 1 .pdf), moved here.

**Phase 0, complete (P0-01 → P0-12):**

- pnpm workspace + Turborepo: root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.npmrc`, `.nvmrc`.
- `apps/issuance` and `apps/verify` — Next.js 16.3.5, React 19, TypeScript, Tailwind v4, App Router, no `src/`, `@/*` alias, no ESLint from the scaffolder. Verify app runs on port 3001.
- Shared config: `tsconfig.base.json`, flat `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`, `.editorconfig`.
- `packages/db` — Prisma 7.10.0 schema for all 7 tables, migration `20260919131700_init` applied to Aiven, `prisma7.config.ts`, `prisma/seed.ts`.
- `scripts/create-db-users.js` — idempotent provisioning of `app_rw` / `verify_ro`, with a built-in privilege test (`--verify-only`, `--print`).
- `.env.example` and `.env.local` for both apps and `packages/db`.

Empty folders still held by `.gitkeep`: `packages/{certificate-render,certificate-templates,certificate-assets,shared}`, `docker/`.

## Decisions made

Full list is AGENTS.md §6; the ones that shape the code:

- **Two apps, one repo.** `apps/issuance` (VPS/Docker, admin + Puppeteer) and `apps/verify` (Vercel, public, read-only). They never call each other — only the shared database.
- **Templates are developer-authored files** in the repo, published to `template_versions` by a `templates:publish` script. No editor, no image upload in the admin panel.
- **Immutable template versions + append-only audit.** Certificates pin `template_version_id`; every create/edit/revoke/restore writes an audit row in the same transaction.
- **Verify page is never cached** (`force-dynamic`, `no-store`); rate limiting via Upstash fails open.
- **Public page shows a summary first** (`public_summary` fields), full certificate behind a button, in a sandboxed iframe. Revoked pages show status + date only.
- **US spelling, US Letter pages, ordinal dates** ("28th of April 2025", `Asia/Colombo`).
- **One-page rule:** a render that would spill to page 2 fails; no PDF is produced.
- **Bulk upload accepts `.xlsx` (preferred) and UTF-8 `.csv`**; duplicates warn rather than block.
- **Admin auth:** password + DB-backed rate limiting, no 2FA (accepted risk, mitigated by audit log).
- **Naming:** `@moraspirit/*` for packages, plain `issuance` / `verify` for apps, `workspace:*` internally.
- **Toolchain hard-pinned:** pnpm 11.20.0, Node >=22 <23, `engine-strict=true`.

## Problems solved

- **Prisma 7 removed `url` from `datasource`** — connection string now lives in `prisma7.config.ts`, which we made load `.env.local` before `.env`.
- **TLS to Aiven failed with `NODE_EXTRA_CA_CERTS`** because the migration engine is a Rust binary using the OS trust store. Fix: `?sslaccept=strict&sslcert=../../.cert/ca.pem` in the CLI connection string. Runtime (driver adapter) takes the CA a different way — hence `DB_CA_CERT_B64` / `DB_CA_CERT_PATH` in the app env files.
- **Prisma's `prisma-client` generator emits TypeScript, not JS.** Node 22 runs it natively via type stripping; `packages/db` is therefore `"type": "module"` and the seed is `seed.ts`.
- **`create-next-app` writes a nested `pnpm-workspace.yaml`** which would make an app its own workspace root. Removed; its `allowBuilds` entries moved to the root file (Prisma's postinstall must be allowed there).
- **`apps/*/.env.example` were git-ignored** — the apps' own `.gitignore` has a blanket `.env*` that beats the root negation. Fixed with `!.env.example` in each.
- **`typecheck` failed on a clean checkout** — Next 16 generates global types (`LayoutProps`) into `.next/types`, so Turbo's `typecheck` now depends on the package's own `build`.
- **`turbo.json` rejects unknown keys** (a `"comment"` field broke it) but accepts `//` comments.
- **Next 16 writes its own `AGENTS.md`/`CLAUDE.md` into each app** and re-adds them on `next dev`. Kept, with a pointer to the root rules appended (open decision D5).
- **ESLint had no Node environment** for plain scripts — added a `globals.node` block for `scripts/**/*.js`, config files and `packages/*/prisma/*.ts`.

## Current state

**Working and verified:**

- `pnpm install`, `pnpm build` (FULL TURBO on repeat), `pnpm lint`, `pnpm typecheck`, `pnpm format:check` — all pass.
- Both apps serve their starter pages (issuance :3000, verify :3001).
- Migration applied to Aiven over verified TLS; all 7 tables confirmed present.
- `app_rw` and `verify_ro` exist with the §3 grants; privilege test passes 11/11 — `verify_ro` cannot write, cannot DROP, cannot read `admin_users`, `certificate_audit`, `import_batches` or `login_attempts`.
- `pnpm db:seed` rebuilds the dataset repeatably: 1 admin, 1 template with 2 versions, 1 import batch, 4 fabricated certificates (1 pinned to v1, 1 revoked), 5 audit rows. Dev login is `admin@moraspirit.test` (password is in the seed script; development-only).

**Environment:** Aiven MySQL 8.4.8 free plan, DigitalOcean `blr`, database `mora-spirit`. Free plan powers off when idle — a morning connection error is usually that. CA certificate at `.cert/ca.pem` (note: singular `.cert`, git-ignored).

**Not started:** everything from Phase 1 onward. `packages/{shared,certificate-render,certificate-templates,certificate-assets}` are empty.

**Nothing has ever been committed** — the owner does all git operations manually (AGENTS.md §8). The working tree holds all of the above as uncommitted changes.

## Next session starts with

**Phase 1 — shared rendering core.** First tasks, in order:

1. **P1-01/P1-02** — `packages/shared`: `FieldSchema` types (`text|date|select|richtext|list`) and the zod generator built from it.
2. **P1-03/P1-04** — the `list` parser (split lines; strip `•`, `-`, `*`, `U+F0B7`; drop blanks; keep order), unit-tested against the real cell strings in `docs/samples/Special Projects Pillar'25 service letters.xlsx`.
3. **P1-05 → P1-10** — `packages/certificate-render`: one Handlebars instance, pronoun mapping, `verb` helper, ordinal `formatDate`, `renderCertificateHtml`, asset resolution (data URIs for Puppeteer, paths for the browser).

Blocked until D2 and D3 are answered (see below). Testing framework (Vitest) is not installed yet — P1-04 needs it.

## Open questions

- **D1 — production database.** Deferred until the system runs against Aiven. PeekHosting shared hosting is the owner's intent but must pass the 7-point gate in architecture §3 (TLS, remote access, MySQL 8, `max_connections`, backups, privilege scoping, region). Decided in Phase 8.
- **D2 — font substitute for Times New Roman** (cannot be bundled): Liberation Serif or Tinos. **Needed for Phase 1.**
- **D3 — one template or two.** The two sample .docx files differ: Bimsara's longer "outstanding contributions" wording vs Imasha's standard one (which also refers to the recipient by surname). Confirm with MoraSpirit which wordings stay in use. **Needed for Phase 1.**
- **D4 — VPS provider and region** (should be near the database). Phase 8.
- **D5 — Next.js-generated `AGENTS.md`/`CLAUDE.md`** inside each app: keep as-is or suppress. Phase 2.
- **D6 — Prisma pinned to 7.10.0**; 8.0.0 exists only as a release candidate. Revisit when stable (changes client instantiation). Phase 8.
- **D7 — resolved.** The `avnadmin` password was printed to a transcript and has been rotated. `app_rw` / `verify_ro` passwords were generated locally and never displayed — they exist only in the `.env.local` files, so those should be backed up somewhere private.
