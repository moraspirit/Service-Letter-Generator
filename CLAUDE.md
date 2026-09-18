# CLAUDE.md

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

- `docs/architecture.md` wins over code. If they disagree, fix the code or update the doc **in the same commit**.
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

## Useful context

- Two Next.js apps, one repository: `apps/issuance` (VPS, Docker, admin + Puppeteer) and `apps/verify` (Vercel, public, read-only). They share `packages/` but are deployed separately.
- The development database is Aiven for MySQL (free plan). The production provider is **not yet chosen** — see decision D1 in `docs/TASKS.md`.
- The project is currently **pre-development**: the folder structure and documentation exist; nothing is scaffolded yet. Phase 0 is next.
