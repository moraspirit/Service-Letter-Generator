# AGENTS.md — working rules for this project

Instructions for any AI agent or developer working in this repository. Read this in full before touching anything.

**Project:** MoraSpirit Certificate & Verification System — an admin issues "Certificate of Employment" service letters as one-page PDFs carrying a QR code; anyone scanning that code reaches a public page that verifies the letter against the live database.

---

## 1. Start every session by reading the docs, in this order

Do this **before** writing code, before proposing a plan, and before answering questions about how the system works. These documents are not background reading — they contain decisions you cannot derive from the code.

| # | File | Why |
|---|---|---|
| 1 | `docs/README.md` | Index and reading order |
| 2 | `docs/architecture.md` | **Source of truth.** Topology, schema, template rules, workflows, security model, and the reasoning behind every decision |
| 3 | `docs/IMPLEMENTATION_PLAN.md` | The 9-phase build order, what each phase contains, and its exit criteria |
| 4 | `docs/TASKS.md` | Current progress, open decisions (D1–D4), and anything blocked |
| 5 | `docs/samples/` | The real letters and spreadsheet the system must reproduce and import — read before Phase 1 and Phase 5 |
| 6 | `PRODUCT.md` / `DESIGN.md` | Who the two audiences are, and the visual system both apps render |
| 7 | `docs/RUNBOOK.md` | Operations. Does not exist until Phase 8 |

Then **state where the project stands** — the current phase and the next unchecked task from `docs/TASKS.md` — before proposing work. Never assume the phase; read it.

The implementation plan carries a per-phase table naming the architecture sections each phase depends on. Re-read those sections when you start that phase.

---

## 2. The three rules that override everything else

1. **`docs/architecture.md` is the source of truth.** If code and the document disagree, either the code is wrong, or the document is updated **as part of the same change**, so the owner can commit them together. Never leave it stale, and never let code silently define behaviour the document contradicts.
2. **Never revisit a settled decision on your own.** Section 6 lists them. If one looks wrong, say so and ask — do not quietly implement something different.
3. **Work the phases in order.** Do not build Phase 5 features while Phase 3 is unfinished. A phase is done only when its exit criteria pass.

---

## 3. Working rules

- **Update `docs/TASKS.md` as you go** — tick tasks when their work is genuinely complete and verified, not when the code merely compiles. Add new tasks to the end of their phase, keeping the ID sequence (`P3-15`, `P3-16`, …).
- **Record decisions in one place.** New open questions go in the "Open decisions" table in `docs/TASKS.md`; settled ones go into `docs/architecture.md`. Never scatter decisions across code comments or chat.
- **Report honestly.** If tests fail, say so and show the output. If something was skipped or stubbed, say which part. Never describe work as done when it is partly done.
- **Ask before anything irreversible:** running migrations against a production database, deleting data, force-pushing, deploying, or rotating credentials.
- **Keep each change self-contained** — schema, code and docs that belong together are finished together, so the owner can commit them as one unit that leaves the repository working.

---

## 4. Code rules

- **TypeScript `strict: true` everywhere. No `any` in shared packages.**
- **One rendering path.** All certificate HTML comes from `renderCertificateHtml()` in `packages/certificate-render`. No app may register its own Handlebars helpers or build its own template string — the live preview, the PDF and the verify page must render identically.
- **Database access lives in `packages/db`.** One Prisma schema. The issuance app owns migrations; the verification app only ever runs `SELECT`s.
- **Never edit an applied migration.** Add a new one.
- **The verification app stays minimal:** one route (`/verify/[uuid]`) plus rate-limit middleware. No auth, no Puppeteer, no write code, no admin routes — ever.
- **Templates and assets are developer-authored files** in `packages/certificate-templates` and `packages/certificate-assets`, published to the database by `templates:publish`. There is no template editor or image upload in the admin panel.
- **Assets and template versions are immutable.** Never rename, overwrite or delete an existing asset file or `template_versions` row — issued certificates reference them. Changes create a new file or version.
- **One design system.** Tokens and component classes live in `packages/ui/src/tokens.css`; shared primitives in `packages/ui/src/`. Component styling uses the `ms-*` classes. **Never use Tailwind utilities inside `packages/ui`** — neither app scans that package, so they silently do nothing. Read `DESIGN.md` before changing anything visual.
- **Never build a `className` by concatenating into a template literal.** The Tailwind Prettier plugin strips leading spaces inside them and fuses the class names. Use `cx()` from `@moraspirit/ui`.
- **Light theme only.** Do not reintroduce `prefers-color-scheme` blocks.
- Match the surrounding code's style, naming and comment density. Don't introduce a new library when one already in the stack does the job.

---

## 5. Security invariants — do not weaken these

Each of these exists for a reason spelled out in `docs/architecture.md` §9. Changing any one requires explicit approval.

- **Puppeteer lockdown:** JavaScript disabled, all requests that aren't `data:` URIs aborted. Images and fonts are inlined, never fetched.
- **Sanitize values, not templates:** rich-text field values are sanitized with a strict allowlist **when saved**; templates are trusted, reviewed code and are never run through DOMPurify.
- **Every change to a certificate writes an audit row in the same transaction.** No code path may change `certificates` without it.
- **The one-page rule:** a render that would spill onto page 2 produces no PDF and fails with a clear error.
- **`verify_ro` stays scoped** to `SELECT` on `templates`, `template_versions` and `certificates`. It must never reach `admin_users`, `certificate_audit`, `import_batches` or `login_attempts`.
- **The verify page is not cached** (`force-dynamic`, `no-store`). Reversing this is a documented decision change, not an optimization you make quietly.
- **Rate limiting fails open** on the public page — verification must never go down because Redis is unavailable.
- **Secrets live only in environment variables.** Never in code, never in a commit, never in a log line.
- **Never log recipient personal data.**

---

## 6. Settled decisions — do not change without asking

| Area | Decision |
|---|---|
| Header images & fonts | Developer-committed files in `packages/certificate-assets`, copied into both apps; no admin upload |
| Fonts | Self-hosted, OFL/Apache-licensed. **Times New Roman must not be bundled** — use **Liberation Serif** (D2) |
| Templates | Immutable versions; editing creates a new version; issued certificates stay on theirs |
| Template authoring | Developer-only, in the repo. No editor in the admin panel |
| Audit | Full `certificate_audit` table, written transactionally |
| Public page | Summary first (`public_summary` fields), full certificate behind "View full certificate", rendered in a sandboxed iframe |
| Revoked page | Status and date only — never the content or the revocation reason |
| Pronouns | Derived from `honorific` (Mr./Ms./Mx.); templates never hardcode a pronoun or a pronoun-dependent verb |
| Language | English, **US spelling**, Latin script only |
| Dates | `formatDate` helper → "28th of April 2025", `Asia/Colombo` |
| Page | US Letter, zero margin, full-bleed letterhead, `printBackground: true` |
| Caching | None on the verify page |
| Bulk upload | `.xlsx` (preferred) and UTF-8 `.csv` |
| Duplicates | Warn, don't block: file hash + per-row `dedupe_key`, admin chooses Skip or Issue anyway |
| Bulk ZIP | Inngest job → temp file on the VPS → admin-only download → deleted after 24 h |
| Certificate ID | UUID v4 only. No human-readable number, no public search |
| Admin auth | Password + database-backed rate limiting. No 2FA (accepted risk, mitigated by the audit log) |
| Public rate limit | Upstash Redis, 60/min/IP, failing open |
| Test database | Aiven for MySQL, free plan |
| Production database | **Undecided** (D1) — decided in Phase 8 against the §3 gate |

---

## 7. Data and environment rules

- **Never put real recipient data in the test database.** Seeds and fixtures use fake names.
- `docs/samples/` contains real names and a real email address. **This repository stays private.** Don't copy sample content into code, tests, commit messages or public issues.
- **Never commit** `.env` files, connection strings, the TLS CA certificate, or generated PDFs.
- Two database users everywhere, including in development: `app_rw` and `verify_ro`. Testing only against `app_rw` defeats the purpose.
- The production database provider is not chosen yet — **no code may depend on a specific provider** beyond the connection string.

---

## 8. Git rules

### Never commit, push, or open a pull request

**The repository owner handles all git operations manually.** Agents write files; the owner decides what becomes history.

- **Never run `git commit`**, not even for work you just finished, and not as a "safe checkpoint".
- **Never run `git push`**, `git merge`, `git rebase`, `git reset --hard`, `git checkout --`, or anything else that rewrites or discards work.
- **Never create branches, pull requests, or releases**, and never use `gh pr create` or any equivalent.
- **Never stage files** with `git add` in anticipation of a commit.
- **Do not set up commit automation** — no hooks, no CI job that commits, no "auto-format and commit" scripts.

What you *may* do freely: `git status`, `git diff`, `git log`, `git show` — anything read-only that helps you understand the current state.

**When work is finished:** say it is ready, list the files you changed, and suggest a commit message the owner can use or ignore. Then stop. If the owner explicitly asks you to commit in a particular message, that permission covers **that one commit only** — it does not carry to the next piece of work.

The one exception already granted: `git init` at the repository root, which has been done.

### Repository hygiene

- **One `.git`, at the repository root.** Scaffold with `create-next-app --no-git`; if a nested `.git` appears under `apps/`, delete it before committing.
- `.gitkeep` files hold the empty folders. Delete each one when its folder gets real content.
- Leave related schema, code and documentation changes **finished together**, so the owner can commit them as one unit.
- Never leave secrets or real personal data in the working tree, where the owner might commit them unknowingly.

---

## 9. Definition of done

A task is done when **all** of these are true:

1. It works against the Aiven test database.
2. The tests named in the phase's exit criteria pass.
3. `docs/architecture.md` still matches reality, or was updated as part of the same change.
4. `docs/TASKS.md` is ticked and accurate.
5. No secrets, no real personal data, and no nested `.git` were committed.
