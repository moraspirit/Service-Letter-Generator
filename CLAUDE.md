# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Read [AGENTS.md](AGENTS.md) first — every rule in it applies to this session.** It is the canonical set of project rules; this file only adds what is specific to working through Claude Code. Where the two ever disagree, `AGENTS.md` wins.

## Before doing anything in a session

Read the documentation in this order, then say which phase the project is in and what the next unchecked task is:

1. `docs/README.md` — index
2. `docs/architecture.md` — **source of truth**: schema, rules, security model
3. `docs/IMPLEMENTATION_PLAN.md` — the 9-phase build order and exit criteria
4. `docs/TASKS.md` — current progress, open decisions, blockers
5. `docs/samples/` — before Phase 1 and Phase 5 (the real letters and spreadsheet)

Do not propose work, estimate, or answer "how does X work" from memory of the code alone. The decisions live in the docs.

## The short version of the rules

- `docs/architecture.md` wins over code. If they disagree, fix the code or update the doc **in the same change**.
- Don't change a settled decision (AGENTS.md §6) on your own — raise it and ask.
- Work phases in order. A phase is finished only when its exit criteria pass.
- Update `docs/TASKS.md` alongside the work it describes, so it is accurate when the owner commits.
- Never weaken a security invariant (AGENTS.md §5).
- Never commit `.env` files, real recipient data, or a nested `.git`.

## Claude Code specifics

- **Keep `docs/TASKS.md` current as you work** — tick tasks when verified, and add any new open decision to its table rather than leaving it in the conversation, which does not persist.
- **Don't scaffold with git.** Use `create-next-app --no-git`; the only `.git` belongs at the repository root.
- **Never commit, push, or open pull requests.** The owner does all git operations manually. Don't run `git commit`, `git push`, `git add`, or `gh pr create` — not even to checkpoint finished work. Read-only git commands (`status`, `diff`, `log`) are fine. When something is ready, list the changed files and suggest a commit message, then stop. Explicit permission to commit applies to that single commit only.
- **Ask before irreversible actions:** production migrations, deleting data, deploying, force-pushing, rotating credentials. Approval for one such action does not carry to the next.
- **Report failures honestly**, with the actual output. Never present partly-finished work as complete.
- **Prefer editing existing files** over creating new ones, and don't add documentation files beyond those in `docs/` unless asked.
- **This repository is private** and `docs/samples/` contains real people's names and an email address. Don't copy that content into code, tests, commit messages or anything that could be published.

## Repository state

**Pre-development.** The folder structure, documentation and `.gitignore` exist; there is no `package.json`, no toolchain and no source code yet. Phase 0 of the implementation plan creates them.

Empty folders are held by `.gitkeep` files — delete each one when its folder gets real content.

## Commands

**None of these exist yet.** They are the commands Phase 0–2 must create, and the names to use when creating them (from `docs/IMPLEMENTATION_PLAN.md`). Verify against `package.json` before quoting any of them to the user.

| Command | Purpose |
|---|---|
| `pnpm build` | Build both apps (Turborepo) |
| `pnpm dev --filter issuance` / `--filter verify` | Run one app in development |
| `pnpm test` / `pnpm test <file>` / `pnpm test -t "<name>"` | Vitest — all, one file, or one test |
| `pnpm test:e2e` | Playwright end-to-end |
| `pnpm --filter db prisma migrate dev` | Create and apply a migration (issuance side only) |
| `pnpm --filter db prisma migrate deploy` | Apply migrations to a target database |
| `pnpm db:seed` | Rebuild the test dataset (one admin + **fake** certificates) |
| `pnpm templates:publish` | Hash `template.hbs` + `schema.json`, insert a new `template_versions` row if changed |

## Architecture in brief

Full detail is in `docs/architecture.md`; this is the shape that takes several files to see.

**Two Next.js apps in one repository, deployed separately.** `apps/issuance` (VPS, Docker) holds the admin panel, Puppeteer and every write path. `apps/verify` (Vercel) holds exactly one route, `/verify/[uuid]`, plus rate-limit middleware. They never call each other — both talk only to the shared MySQL database, with different credentials (`app_rw` vs `verify_ro`). That is what keeps verification working while the VPS is down, and why an issuance URL on the Vercel domain is a 404: the code isn't in that build.

**One rendering path, three consumers.** `packages/certificate-render` owns the single Handlebars instance, the helpers, and `renderCertificateHtml()`. The admin's live preview, the Puppeteer PDF and the public verify page all call it. Registering helpers anywhere else is how the three silently diverge.

**Templates are code, not data entered by the admin.** A developer writes `packages/certificate-templates/<slug>/template.hbs` + `schema.json`; `templates:publish` hashes them and inserts an immutable `template_versions` row on change. Each certificate stores the `template_version_id` it was issued with, so editing a template never alters already-issued letters.

**`field_schema` drives four things at once:** the generated admin form, the spreadsheet import mapping, the zod validation, and which fields appear in the public summary (`public_summary`) and the duplicate key (`dedupe`). Adding a field type means touching the parser, the form renderer and the importer together.

**Nothing is destructive.** Certificates are revoked, never deleted; every create/edit/revoke/restore writes a `certificate_audit` row in the same transaction; template versions and committed assets are immutable because issued certificates reference them.

**PDFs are never stored** (the temporary bulk ZIP is the only exception). They are re-rendered on demand from `data` + the pinned template version, which is why verification always reflects the live record rather than a file someone could alter.

**Source material lives in `docs/samples/`**: the real service letters and the pillar spreadsheet. The template wording, the `list` bullet parser, the `Gender` → honorific mapping and the one-page rule all exist because of specifics in those files — read them before Phase 1 or Phase 5 rather than guessing the formats.
