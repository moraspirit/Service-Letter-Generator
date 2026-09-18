# Documentation

All project documentation for the MoraSpirit Certificate & Verification System.

## Reading order

| # | Document | What it is | When to read |
|---|---|---|---|
| 1 | [architecture.md](architecture.md) | **The source of truth.** Deployment topology, tech choices and why, the database schema, template variable rules, the end-to-end workflows, asset/font/page rules, and the security model. | In full, before writing any code |
| 2 | [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | The build order: 9 phases, what each one contains, and its exit criteria. | After the architecture |
| 3 | [TASKS.md](TASKS.md) | Progress tracker: ~110 numbered tasks, milestones, open decisions, blockers. | Daily, while building |
| 4 | RUNBOOK.md | Operations: deploying, publishing a template, rotating credentials, restoring a backup, handling a failed ZIP job. | Written in Phase 8 |
| 5 | [samples/](samples) | The existing MoraSpirit service letters (.pdf/.docx) and the real pillar spreadsheet (.xlsx) the system must reproduce and import. | Before Phase 1 and Phase 5 |

## Ground rule

The architecture document is authoritative. When code and the document disagree, either the code is wrong or the document is updated **in the same commit** — it is never left stale.

Decisions that are still open live in the "Open decisions" table in [TASKS.md](TASKS.md), not scattered across these files.
