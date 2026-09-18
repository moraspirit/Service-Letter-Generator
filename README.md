# MoraSpirit Certificate & Verification System

Issues "Certificate of Employment" service letters as one-page PDFs carrying a QR code, and lets anyone scan that code to verify a letter is genuine against the live database.

Two apps in one repository:

| App | Runs on | Audience |
|---|---|---|
| `apps/issuance` | VPS (Docker) | Admin only — templates, issuance, bulk import, PDF generation |
| `apps/verify` | Vercel | Public — the `/verify/[uuid]` page a QR scan opens |

## Documentation

Everything lives in [`docs/`](docs). Start with [docs/README.md](docs/README.md) for the reading order.

- [docs/architecture.md](docs/architecture.md) — decisions, schema, security model (source of truth)
- [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) — the 9-phase build order
- [docs/TASKS.md](docs/TASKS.md) — progress tracker and open decisions

## Status

Pre-development. The folder structure exists; the apps and packages are not scaffolded yet — see Phase 0 in the implementation plan.

## Note on `docs/samples/`

Contains real MoraSpirit service letters and a member spreadsheet, including real names and an email address. **Keep this repository private**, or remove those files before publishing it anywhere.
