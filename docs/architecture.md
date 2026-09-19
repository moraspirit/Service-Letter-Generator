# Certificate Generation & QR Verification System — Architecture

Single-admin system for issuing certificates from developer-authored, versioned templates (one by one or via bulk spreadsheet upload), generating downloadable PDFs with an embedded QR code, and letting anyone scan that QR code to verify a certificate is authentic.

The system has **three independent pieces sharing one MySQL database**: a VPS-hosted issuance app (admin panel + PDF generation), a Vercel-hosted verification app (the public page people land on after scanning a QR code), and the MySQL database itself, hosted separately from both on a managed provider.

---

## 1. Deployment Topology

| App / Service | Hosted on | Audience | Responsibilities |
|---|---|---|---|
| **Issuance app** | VPS (Docker) | Admin only (authenticated) | Template list + preview (templates are developer-authored, see §6 A), manual + bulk spreadsheet issuance, Puppeteer PDF generation, Inngest bulk jobs, owns all database writes and migrations |
| **Verification app** | Vercel | Public (unauthenticated) | Serves `/verify/[uuid]` only — read-only, no PDF rendering, no admin functionality |
| **Database** | Managed MySQL provider (separate from both) | — | Single source of truth both apps connect to independently over the network |

**Why split them:** the verification page is the one part of the system that's fully public and needs to stay reachable and fast under any traffic pattern (e.g. a lot of people scanning certificates at once during an event) without depending on whatever the VPS is doing at the time. Vercel's automatically scaling serverless functions are a good fit for that narrow, read-only job. The heavy, stateful work — Puppeteer, the admin panel, background jobs — stays on the VPS, where it already needs to live.

Hosting the database independently of the VPS is what actually makes that split meaningful rather than cosmetic: **the verification app no longer depends on the VPS being up at all.** If the VPS is mid-deployment, restarting, or down for maintenance, someone scanning a QR code still gets a working verification page, since it only talks to the database and never to the VPS. The issuance app is the only thing that goes offline in that scenario — admins can't issue new certificates, but every certificate already issued keeps verifying normally.

Both apps live in **one monorepo** — two `apps/` folders sharing a single Prisma schema and a single rendering package — so the two can't silently drift out of sync on what a `certificate` record looks like or how it renders.

### Two apps, one repository

This is **not one Next.js project deployed twice.** It is two separate Next.js apps that happen to share code:

```
apps/
├── issuance/   -> built into a Docker image -> runs on the VPS  (admin.<domain>)
└── verify/     -> built by Vercel           -> runs on Vercel   (verify.<domain>)
```

Vercel's project Root Directory is `apps/verify`; it never builds `apps/issuance`. The Docker build does the reverse. Each app has its own `package.json`, its own routes, and its own environment variables.

**What is in each build**

| | Issuance app (VPS) | Verification app (Vercel) |
|---|---|---|
| Routes | Admin panel, issuance forms, imports, all write APIs | `/verify/[uuid]` and the rate-limit middleware — nothing else |
| Auth | Auth.js sessions, `AUTH_SECRET`, password hashing | None at all |
| PDF | Puppeteer + Chromium, QR generation | Not a dependency |
| Jobs | Inngest (ZIP export, cleanup cron) | None |
| Database user | `app_rw` — full read/write, owns migrations | `verify_ro` — `SELECT` on `templates`, `template_versions`, `certificates` |
| Shared packages | `certificate-render`, `shared`, `db`, `certificate-assets` | The same packages — each app bundles only what it imports |

**So what happens if someone opens an issuance URL on the Vercel domain?** They get a **404**: those pages and API handlers are not part of that build. The protection is not an access check that could be misconfigured — the code simply isn't deployed there.

Three further layers make an accidental write from the public side impossible rather than merely unlikely: the verify app's database user cannot `INSERT` or `UPDATE` anything; it has no session system, so nothing can authenticate as an admin; and it has no Chromium, so no PDF can be produced. The worst outcome of a deployment mistake is an error, never a rogue certificate.

**Build hygiene:** use an ignored-build step on the Vercel project (e.g. `npx turbo-ignore`) so a commit touching only the issuance app doesn't trigger a verification-app deployment.

---

## 2. Tech Stack & Rationale

| Layer | Choice | Why |
|---|---|---|
| App framework | **Next.js** (x2 deployments) | One framework, two purpose-built apps: a full admin/rendering app on the VPS, and a minimal public app on Vercel. Shared conventions, shared Prisma schema. |
| Database | **MySQL** | Relational structure fits this domain well (templates, certificates, clear foreign keys). Hosted independently of both apps on a managed provider (see §3). |
| ORM | **Prisma** | Type-safe queries end-to-end with TypeScript, handles migrations cleanly. Only the issuance app runs migrations; the verification app uses its own Prisma client against the same schema, read-only by convention (no migration calls, no write queries in its code). |
| PDF rendering | **Puppeteer** (headless Chromium) | Renders real HTML/CSS with a real browser engine — proper vector text, real font embedding, accurate layout. Runs only on the VPS as a persistent, pooled browser process; never runs on Vercel. Used to produce the actual downloadable `.pdf` file at issuance time. |
| Verification page rendering | **Server-side Handlebars compile + Next.js SSR** (no Puppeteer) | The verify page needs to *display* the certificate, not export a PDF file — the visitor's own browser is already a full rendering engine, so no headless browser is needed. The Vercel app compiles the same Handlebars template with the certificate's data and renders it as a normal styled page. |
| Template engine | **Handlebars** | Certificates aren't simple find-and-replace — some paragraphs are conditional, and pronouns change per person. Handlebars' `{{#if}}` blocks and loops handle this; plain `{{placeholder}}` string replacement can't. |
| QR generation | **`qrcode`** (npm) | Generates a QR code as a base64 PNG, embedded straight into the HTML template as an `<img>` before Puppeteer renders it. The QR now encodes the **Vercel verification domain**, e.g. `https://verify.yourdomain.com/verify/{uuid}`, not the VPS domain. |
| Certificate ID | **UUID v4** | Non-sequential and unguessable, so certificates can't be enumerated by guessing IDs. Used as the lookup key on both apps and encoded into the QR code's target URL. |
| Spreadsheet parsing | **SheetJS (`xlsx`)** for `.xlsx`, a strict CSV parser (e.g. `papaparse`) for `.csv` | The real bulk source is an Excel sheet whose cells hold multi-line bulleted text; parsing it directly avoids the encoding and line-break damage of a CSV export (see §6 C). |
| Background jobs | **Inngest** | Used only on the issuance app, for bulk ZIP generation of an import batch and the 24-hour ZIP cleanup cron — not for single-certificate generation. Runs your functions inside your own VPS app over HTTP, so Puppeteer/Chromium stays exactly where it already lives. |
| Auth | **NextAuth / Auth.js (credentials) or equivalent session-based login** — email + password, hashed, with login rate limiting; no 2FA (see §9) | Protects every route on the issuance app only. The verification app has no login system at all — there's nothing on it to protect. |
| Cross-service data access | **Independent direct Prisma connections from both apps** | See §3 — the VPS and Vercel each hold their own connection string to the externally-hosted MySQL instance, over TLS. Neither app talks to the other directly. |
| Issuance hosting | **VPS + Docker** | Full control, a persistent process (good for Puppeteer and background workers), no serverless timeout/cold-start constraints. |
| Verification hosting | **Vercel** | Zero server maintenance, automatic scaling — well suited to a small, public, read-only page. The verify route runs as a Node.js serverless function (not the Edge runtime) **deployed in the same region as the database**, since every request queries the database. Works independently of VPS uptime, since it never talks to the VPS. |
| Public rate limiting | **Upstash Redis + `@upstash/ratelimit`** (Next.js middleware, verification app only) | Works on any Vercel plan, serverless-friendly HTTP API, free tier. Fails open so it can never block legitimate verification (see §9). |
| Database hosting | **Managed MySQL-compatible provider** (provider not fixed — must meet the requirements in §3) | Decouples the database's uptime from either app's uptime, and hands off backups/patching/TLS certs to the provider. |

---

## 3. Database & Cross-Service Connectivity

The database lives on its own managed MySQL provider, independent of both apps. The issuance app (VPS) and the verification app (Vercel) each hold their own connection string and their own Prisma client — neither one is "closer" to the database than the other, and neither app ever talks directly to the other.

**Choosing a provider:** this architecture deliberately does **not** commit to a specific provider. Any managed MySQL-compatible host is acceptable if it meets **all** of these requirements:
- MySQL 8 compatible and supported by Prisma (standard `mysql://` connection string).
- Enforced TLS connections from the public internet.
- Support for multiple database users with `GRANT`-level permissions (needed for the `SELECT`-only verification user).
- A way to handle many short-lived serverless connections — either an HTTP/serverless driver usable with a Prisma driver adapter, or a built-in/available connection pooler.
- Automated daily backups with point-in-time recovery (or at least daily snapshots) and a documented restore process.
- A region available near both the VPS and the chosen Vercel function region.

### Environments

| Environment | Database | Status |
|---|---|---|
| **Development / testing** | **Aiven for MySQL, free plan** | **Decided.** Genuine MySQL 8 with enforced TLS and full `GRANT` support, so the dev environment behaves like production instead of lying about it. The free plan has no backups and may be suspended when idle — acceptable for throwaway data, which is why a seed script (`prisma migrate reset` + fake sample rows) must be able to rebuild it in one command. |
| **Production** | **Not yet decided** | Deliberately deferred until the system is running against Aiven. Candidates: a paid Aiven plan (adds backups + PITR), DigitalOcean Managed MySQL (adds a built-in pooler), Neon (Postgres; removes the serverless-connection problem), or the existing **PeekHosting shared hosting** — which is only viable if it passes the checks below. |

**Testing rules:** never put real recipient data in the test database — it has no backups, weaker access control, and ends up in screenshots and logs. Create **both** database users there (read/write and `SELECT`-only) so the verification app's read-only path is genuinely exercised. Every migration runs on the test database before production. Keep the test connection string out of any production environment, and vice versa.

**Before PeekHosting (or any shared host) can be accepted for production**, all of the following must be confirmed — any single failure rules it out:
1. **TLS is supported and enforced** on the MySQL connection, with a CA certificate available. Without this, credentials and recipient personal data travel the public internet in plaintext from both apps. Verify with `mysql -h HOST -u USER -p --ssl-mode=REQUIRED -e "SHOW STATUS LIKE 'Ssl_cipher'"`.
2. **Remote access works without allowlisting every caller.** Vercel's outbound IPs are dynamic; if the host requires an IP allowlist, it means either Vercel Static IPs (Pro plan) or opening the database to `%`, which is not acceptable on its own.
3. **Server is MySQL 8** — not MySQL 5.7, and not MariaDB (whose `JSON` is really `LONGTEXT`, which affects the `data` and `field_schema` columns under Prisma).
4. **`max_connections`** is comfortably above the expected scan peak, since the verify page is uncached (§6 D).
5. **Backups** run at least daily with a restore process you have tested yourself.
6. **Privilege scoping:** cPanel-style hosts grant privileges per database, not per table. If a table-scoped `SELECT` user is impossible, the schema must be **split into two databases** — one holding `templates`, `template_versions`, and `certificates` (the verification user's only reach), the other holding `admin_users`, `certificate_audit`, `import_batches`, and `login_attempts`.
7. **Region** is close enough to the VPS and the Vercel function region to keep the uncached verify query fast.

If a shared host is chosen despite a weak connection limit, the escape hatch is a short cache (30–60 s) on the verify page — which reverses the "no caching" decision in §6 D and should be a conscious change, not a silent one.

**What this setup needs to be safe in production, regardless of provider:**
- **TLS-enforced connections** — required for both apps, since both now connect over the public internet rather than a local network.
- **Separate, scoped credentials per app** — the issuance app's DB user needs full read/write; the verification app's DB user should be a distinct login scoped to `SELECT` only on `templates`, `template_versions`, and `certificates`. That way a leaked connection string from either side has a limited blast radius.
- **Network exposure** — most managed providers handle this for you (TLS by default, sometimes IP allowlisting). If the provider supports IP allowlisting and you want to use it from the Vercel side, Vercel's **Static IPs** feature (Pro tier and above) gives a stable IP range to allow, since its default outbound traffic otherwise comes from a dynamic range.
- **Connection pooling** — the verify page is **not cached** (see §6 D), so every scan is a live database query, and serverless functions open many short-lived connections that can exhaust a database's `max_connections` during an event rush. Therefore, from day one: use a serverless-aware driver or pooler for the verification app (e.g. Prisma with an HTTP/serverless driver adapter, or a connection pooler in front of the database), keep the Prisma client as a module-level singleton, and set a low `connection_limit` per function instance.
- **Region** — deploy the Vercel verify function in the region closest to the database (Vercel project → Functions region), since each request makes a database round trip.
- **Query cost** — the verify request is two primary-key lookups (`certificates` by UUID → `template_versions` by id) and nothing else, so it stays cheap even without caching.

**Migrations** are owned solely by the issuance app — it's the only side that ever changes the schema. The verification app's Prisma client only ever runs `SELECT` queries against the same schema, so there's no risk of the two apps disagreeing about what it looks like.

---

## 4. Database Schema

```
templates
  id                   INT PK AUTO_INCREMENT
  name                 VARCHAR(255)
  current_version_id   INT FK -> template_versions.id NULL  -- version used for NEW certificates
  created_at           DATETIME
  updated_at           DATETIME

template_versions                -- immutable: rows are inserted, never updated or deleted
  id             INT PK AUTO_INCREMENT
  template_id    INT FK -> templates.id
  version_number INT             -- 1, 2, 3 ... per template; UNIQUE (template_id, version_number)
  html_content   LONGTEXT        -- Handlebars template (HTML + CSS + {{placeholders}})
  field_schema   JSON            -- defines each variable: name, label, type, required, options, public_summary, dedupe
  content_hash   CHAR(64)        -- SHA-256 of html_content + field_schema; used by the publish script to detect changes
  created_at     DATETIME

certificates
  id                   CHAR(36) PK     -- UUID v4
  template_version_id  INT FK -> template_versions.id   -- locked at issuance, never changes; INDEX
  data                 JSON            -- filled-in variable values for this certificate
  import_batch_id         INT FK -> import_batches.id NULL    -- NULL for manually issued certificates
  dedupe_key           CHAR(64)        -- SHA-256 of template_id + normalized values of the fields flagged `dedupe: true`; INDEX (not unique)
  status               ENUM('active','revoked')
  revoked_at           DATETIME NULL
  revocation_reason    VARCHAR(500) NULL
  issued_at            DATETIME
  created_at           DATETIME
  updated_at           DATETIME

certificate_audit                -- append-only: rows are inserted, never updated or deleted
  id               BIGINT PK AUTO_INCREMENT
  certificate_id   CHAR(36) FK -> certificates.id
  action           ENUM('created','edited','revoked','restored')
  old_data         JSON NULL     -- previous certificates.data (NULL for 'created')
  new_data         JSON NULL     -- new certificates.data (NULL for 'revoked'/'restored')
  reason           VARCHAR(500) NULL   -- required for 'edited', 'revoked', 'restored'
  admin_user_id    INT FK -> admin_users.id
  created_at       DATETIME

import_batches
  id                   INT PK AUTO_INCREMENT
  template_version_id  INT FK -> template_versions.id
  file_name            VARCHAR(255)
  file_type            ENUM('xlsx','csv')
  sheet_name           VARCHAR(255) NULL   -- which worksheet was imported (xlsx only)
  file_hash            CHAR(64)        -- SHA-256 of the uploaded file; INDEX
  row_count            INT
  inserted_count       INT
  skipped_count        INT             -- rows the admin chose to skip as duplicates
  zip_status           ENUM('none','queued','generating','ready','failed','expired') DEFAULT 'none'
  zip_rendered_count   INT DEFAULT 0   -- progress for the UI
  zip_path             VARCHAR(500) NULL   -- temp file on the VPS export volume
  zip_expires_at       DATETIME NULL       -- generated_at + 24h; cleanup job deletes the file after this
  admin_user_id        INT FK -> admin_users.id
  created_at           DATETIME

admin_users
  id             INT PK AUTO_INCREMENT
  email          VARCHAR(255) UNIQUE
  password_hash  VARCHAR(255)
  created_at     DATETIME

login_attempts                   -- failed admin logins, for rate limiting (§9)
  id             BIGINT PK AUTO_INCREMENT
  email          VARCHAR(255)
  ip_address     VARCHAR(45)     -- IPv4 or IPv6
  attempted_at   DATETIME        -- INDEX (email, ip_address, attempted_at); rows older than 24h are purged
```

Key decision: **no PDF file is ever stored.** Only `html_content` + `data` (JSON) are persisted, and only the issuance app can write them. The PDF is generated on demand — on download from the issuance app — so the output always reflects the current database record, not a possibly-stale or tampered file. The only exception is the bulk ZIP export (§6 C step 17): a **temporary** file on the VPS, admin-only, deleted automatically after 24 hours. It is a convenience copy, never a source of truth.

Key decision: **template versions are immutable.** Editing a template never modifies an existing `template_versions` row — it inserts a new version and points `templates.current_version_id` at it. Each certificate references the exact `template_version_id` it was issued with, so an already-issued certificate's wording and design never change retroactively, on the verify page or in a re-downloaded PDF. The verification app's read-only DB user needs `SELECT` on `template_versions` in addition to `templates` and `certificates`.

Key decision: **every change to a certificate is audited.** Creating, editing, revoking, or restoring a certificate writes a row to `certificate_audit` **in the same database transaction** as the change itself, so a change can never happen without its audit record. The audit table is append-only. The verification app's DB user has **no** access to `certificate_audit` or `admin_users`.

---

## 5. Template Variable Design

Based on the sample certificates reviewed, fields fall into three categories:

- **Simple substitutions** — `recipient_name`, `pillar_name`, `start_date`, `end_date`.
- **Derived fields** — `honorific` is a required select field with exactly three options. It is the only gender-related input; all pronouns are **derived** from it and never entered or stored separately:

  | `honorific` | `pronoun_subject` | `pronoun_object` | `pronoun_possessive` | Verb form |
  |---|---|---|---|---|
  | Mr. | He | him | his | singular (*he is / he has*) |
  | Ms. | She | her | her | singular (*she is / she has*) |
  | Mx. | They | them | their | plural (*they are / they have*) |

  Bulk source sheets carry a **`Gender`** column (`Male` / `Female`) rather than an honorific, so the importer maps `Male → Mr.`, `Female → Ms.` (case- and whitespace-insensitive); anything else, including a blank cell, fails validation for that row. `Mx.` has no equivalent in the source data and is set through manual entry or by editing the record.

  The template body **never hardcodes a pronoun or a pronoun-dependent verb**. Templates use the derived values plus a verb helper, e.g. `{{pronoun_subject}} {{verb "is" "are"}} a dedicated member` → "He is …" / "They are …". Capitalized and lowercase variants are both provided (e.g. `{{Pronoun_subject}}` at the start of a sentence).
- **List fields (bulleted sections)** — `general_points` and `special_points` are **`list`** fields: an ordered array of bullet strings rendered with `{{#each}}`. In the real source spreadsheet each of these arrives as **one cell containing several bullets separated by blank lines**, so the importer parses a `list` cell as follows:
  1. split the cell on line breaks (`
`, `
`);
  2. strip a leading bullet marker from each line — `•`, `-`, `*`, or the Symbol-font private-use bullet `U+F0B7` that Word/Excel produces — plus surrounding whitespace;
  3. drop empty lines;
  4. keep the remaining lines in order as the array.
  The same parsing runs for `.xlsx` and `.csv`, and for text pasted into the manual-entry form (which uses a multi-line textarea, one bullet per line). A `list` field can be `required: false`, in which case an empty cell yields an empty array and the surrounding `{{#if}}` block is skipped — this is exactly how "General" letters differ from "Special" ones in the sample data.
- **Narrative / optional fields** — `intro_summary` and `closing_note` are rich text, written per recipient. `notable_achievements` is optional and wrapped in a Handlebars conditional so the whole paragraph and its bullet list are skipped cleanly when empty:

```handlebars
{{#if notable_achievements}}
<p>Beyond {{pronoun_possessive}} core responsibilities, {{recipient_name}} ...</p>
<ul>
  {{#each notable_achievements}}<li>{{this}}</li>{{/each}}
</ul>
{{/if}}
```

Each template version stores its own `field_schema` (list of fields with name/label/type/required/options/`public_summary`/`dedupe`), which drives both the admin's manual-entry form and the CSV column mapping — this is what keeps the system generic across different certificate designs.

**Field set used by the MoraSpirit service letters** (derived from the sample letters and the pillar spreadsheet):

| Field | Type | Notes |
|---|---|---|
| `member_id` | text, required | e.g. `SPL2501`. Flagged `dedupe: true`; the natural key for duplicate detection and admin search. Not shown publicly. |
| `recipient_name` | text, required | Full name, trimmed. `public_summary: true`. |
| `recipient_surname` | text, optional | **Not in either current template.** The older .docx wording said "Ms. Gallage", but the current PDF wording uses the full name throughout. If a future wording needs a surname it must be its own field — surnames can't be split reliably from `recipient_name`. |
| `honorific` | select, required | `Mr.` / `Ms.` / `Mx.` — drives all pronouns (above). |
| `pillar_name` | text, required | e.g. "Special Projects Pillar", "Creative Design Pillar". `public_summary: true`. |
| `start_date`, `end_date` | date, required | `public_summary: true`. |
| `general_points` | list, required | The shared bullet list every member receives. |
| `special_points` | list, optional | Present only for "Special" letters; the whole paragraph plus list is wrapped in `{{#if special_points}}`. |
| `signatory_name`, `signatory_title`, `signatory_email` | text, required | Currently "Heminda Jayaweera / Co-Founder, MoraSpirit / heminda@moraspirit.com". Kept as fields, not hardcoded text, so a change of signatory doesn't require a new template version. Each carries a schema `default` (see below), which the form pre-fills and the importer uses for blank cells. |

The `Letter type` column in the source sheet (General / Special) needs no field of its own: a letter is "Special" exactly when `special_points` is non-empty, and the template's `{{#if}}` already handles that. Genuinely different wordings — such as the longer "outstanding contributions" letter versus the standard one — are **separate templates**, not conditionals inside one template.

**Shared rendering package.** The same template must render identically in three places: the client-side live preview (§6 B), Puppeteer on the VPS, and the verification page on Vercel. So all rendering logic lives in **one shared monorepo package**, e.g. `packages/certificate-render`, used by both apps:
- a single configured Handlebars instance and all custom helpers (`verb`, date formatting, capitalisation);
- **Date formatting** via a `formatDate` helper with a fixed time zone (`Asia/Colombo`, the same on the VPS, Vercel, and in the browser). The house style matches the existing letters: **ordinal day, "of", month, year** — `{{formatDate start_date}}` → "28th of April 2025" (1st, 2nd, 3rd, 4th …). The sample letters are inconsistent here ("28th of April 2025" vs "28th April 2024"); the helper settles it, and templates must never hand-write a date. Dates are stored in `data` as ISO `YYYY-MM-DD` strings;
- the honorific → pronoun mapping above, applied to `data` before compiling (derived values are computed at render time, never stored in `certificates.data`);
- one `renderCertificateHtml(templateVersion, data)` function that every caller uses.

Neither app may register its own helpers or duplicate this logic, so the preview, the PDF, and the verify page can't drift apart.

---

## 6. End-to-End Workflow

### A. Creating/editing a template (developer, in the repo)

Templates are **trusted code written by a developer**, not edited by the admin. There is no HTML/CSS editor in the admin panel.

1. Developer writes the HTML/CSS design as a Handlebars file in the monorepo, e.g. `packages/certificate-templates/<template-slug>/template.hbs`, using `{{placeholders}}` and conditional blocks where needed, and referencing images from `/certificate-assets/...` (see §7).
2. Developer defines the field schema next to it in `schema.json` — each variable's name, label, type (text / date / select / rich text / list), whether it's required, select options, whether it appears in the public verification summary (`public_summary`, see §6 D), and whether it is part of the duplicate-detection key (`dedupe`, see §6 C).
3. The change goes through normal code review and is committed.
4. On deploy, a **template publish script** in the issuance app (e.g. `pnpm templates:publish`, run as part of the release) compares each template's `template.hbs` + `schema.json` against the latest `template_versions` row using a content hash. If anything changed, it inserts a **new row in `template_versions`** (next `version_number`) and updates `templates.current_version_id`. Unchanged templates are skipped. Existing versions are never modified.
5. In the admin panel, the admin can only **view** templates: list, see version history, and preview a version with sample data.

### B. Issuing a single certificate (manual entry, issuance app)

6. Admin selects a template; a form is generated automatically from the field schema of the template's current version.
7. As the admin types, a live preview renders in the browser using the shared `renderCertificateHtml` function (§5) — no backend call, no PDF generation at this stage.
8. Admin clicks **Generate**. The filled-in field values are sent to the backend.
9. Backend validates the data against the current version's field schema (dates normalised to ISO, rich-text fields sanitised — §9) and computes the `dedupe_key`. If a certificate with the same key already exists, the backend returns a warning with a link to it, and the admin either cancels or confirms **Issue anyway**. The backend then generates a UUID and, **in one transaction**, inserts a new row into `certificates` (`id` = UUID, `template_version_id` = the template's `current_version_id` at this moment, `data`, `dedupe_key`, `import_batch_id = NULL`, `status = active`) plus a `created` row in `certificate_audit`.
10. Backend returns the UUID to the frontend.
11. Backend renders the actual PDF: the shared render function fills the certificate's template version with its data, a QR code (encoding `https://verify.yourdomain.com/verify/{uuid}` — the **Vercel** domain) is generated and embedded as a base64 image, images and fonts are inlined (§7), and the locked-down Puppeteer instance (§9) outputs the final PDF. The same function is used whenever a PDF is re-downloaded later.
12. The PDF is streamed back to the frontend for download. It is not saved anywhere — only the template version and data stay in MySQL.

### C. Issuing certificates in bulk (spreadsheet upload, issuance app)

13. Admin uploads a spreadsheet — **`.xlsx` or UTF-8 `.csv`** — whose column headers match the template's field schema.
    - **`.xlsx` is the preferred format** and is parsed directly (e.g. SheetJS), because the real source files contain multi-line cells, bullet characters, and curly quotes that an Excel "Save as CSV" export routinely mangles (line breaks split into rows, ANSI encoding corrupting `'` and `’`).
    - For `.xlsx`, if the workbook has several worksheets the admin picks one; its name is recorded on the batch.
    - `.csv` is accepted but must be UTF-8 (a BOM is tolerated and stripped). Non-UTF-8 files are rejected with a message telling the admin to upload the `.xlsx` instead.
    - Header matching ignores case and surrounding whitespace. Unknown columns are reported and ignored; missing required columns fail the upload.
    - Every cell value is trimmed of leading/trailing whitespace before validation (the sample data has names like `" Raveesha Dananji "`).
14. Backend validates every row (required fields present, dates valid, select values valid, rich text sanitised, `list` cells parsed into arrays per §5). In `.xlsx` files, real Excel date cells are read as dates directly (no string parsing, no timezone shift). Text dates, in either format, are accepted **only** as ISO `YYYY-MM-DD` or `DD/MM/YYYY`; US-style `MM/DD/YYYY` is not supported, and any ambiguous or unparseable date fails validation rather than being guessed. Accepted dates are normalised to ISO before saving. Every failing row is listed in an error report, and nothing is committed until all rows pass.
15. **Duplicate check (warn, don't block):**
    - **Same file:** the backend hashes the file. If a `import_batches` row with the same `file_hash` already exists, the admin sees a warning: "This file was already imported on {date} by {admin} ({n} certificates)."
    - **Same certificate:** for each row, the backend computes its `dedupe_key` from the fields flagged `"dedupe": true` in the field schema (for these letters: `member_id`, falling back to `recipient_name` + `start_date`; values trimmed and lower-cased) and looks for existing certificates with the same key. Matching rows are flagged in the preview with a link to the existing certificate.
    - For each flagged row the admin chooses **Skip** (default) or **Issue anyway**; the admin can also cancel the whole upload.
16. On confirm, a `import_batches` row is created and the chosen rows are bulk-inserted into `certificates` **in one transaction**, each with its own generated UUID, `status = active`, `import_batch_id`, `dedupe_key`, the same `template_version_id` (the version the CSV was validated against), and a `created` row in `certificate_audit`. The batch records how many rows were inserted and skipped.
17. **Download all as ZIP (optional).** From the batch page, the admin clicks **"Generate ZIP"**. This is handed to an **Inngest** background job on the VPS:
    - The job renders each certificate as its **own Inngest step**, calling the *same* render function used in step 11, so a failure retries only that certificate, not the whole batch.
    - Rendered PDFs are written to a per-batch temp folder on a dedicated Docker volume (e.g. `/data/tmp-exports/{batch_id}/`), then zipped into `{batch_id}.zip`. Puppeteer concurrency is capped (e.g. 2–3 pages at once) so a large batch can't exhaust VPS memory.
    - Progress (`zip_status`, rendered count) is stored on the `import_batches` row and shown in the UI.
    - When done, the batch page shows a **Download ZIP** button. The download route is admin-authenticated and streams the file; the ZIP is never publicly reachable.
    - The ZIP and its temp folder are **deleted automatically 24 hours** after generation (`zip_expires_at`) by a scheduled Inngest cron function. After that, the admin can simply generate it again.

### D. Verifying a certificate (public, via QR scan — now on the verification app)

18. Someone scans the QR code on a certificate, opening `https://verify.yourdomain.com/verify/{uuid}` — the **Vercel-hosted** verification app.
19. The verification app queries the database directly via its own Prisma client (§3): the `certificates` row (`data`, `status`) and the exact `template_versions` row it was issued with (`html_content`) — a straight `SELECT`, no calls to the issuance app.
20. **Not found** (or not a valid UUID format) → page shows "Not a valid certificate."
21. **Found, `status = revoked`** → page shows "This certificate has been revoked" and the revocation date (`revoked_at`). The certificate content and the revocation reason are **not** shown publicly.
22. **Found, active** → the page is shown in two layers:
    - **Summary (shown immediately):** a "Verified — Authentic" badge plus only the fields marked `"public_summary": true` in the certificate's template version `field_schema` (typically recipient name, certificate title, start/end dates), along with the issue date and status. Which fields appear is decided per template, not hardcoded.
    - **Full certificate (on demand):** a **"View full certificate"** button reveals the complete rendered certificate on the same page. The backend compiles the template version's `html_content` with the certificate's `data` using the shared `renderCertificateHtml` function (plain server-side JS, no headless browser involved) and renders it inside a sandboxed `<iframe srcdoc>` (§9), styled to look like the certificate page (page-sized container, bundled fonts).

This gives a close visual match of the actual certificate design without needing Puppeteer, `@sparticuz/chromium`, or any dependency on the VPS: the same Handlebars template that produces the downloadable PDF on the issuance side is simply rendered by the browser viewing the page, the same way the live preview in Part B works.

**Field schema flag:** each field in `field_schema` has an optional `public_summary` boolean (default `false`). The developer sets it in the template's `schema.json` (§6 A step 2). Narrative fields (`intro_summary`, `closing_note`, `notable_achievements`) should normally stay `false`, so they only appear when a visitor deliberately opens the full certificate.

This is still the core of the system's trust model: verification always reflects the live database record, not the physical/downloaded PDF, so a tampered printout still resolves to the true record when scanned — it's just served from a different app now.

**No caching.** The verify page is rendered dynamically on every request (`export const dynamic = 'force-dynamic'`, `Cache-Control: no-store`) — no CDN caching, no ISR. A revocation or edit made in the issuance app is visible on the very next scan, and the issuance app never has to call the verification app. The cost is one database query per scan, handled by the connection safeguards in §3.

---

## 7. Assets, Fonts & PDF Page Rules

The certificate header (the diagonal wave graphic) is treated as a **static image**, not hand-coded CSS gradients/shapes. Images are **added by a developer, not uploaded by the admin** — there is no image-upload feature in the admin panel.

- **Single source of truth:** all certificate images live in a shared monorepo package, e.g. `packages/certificate-assets/`. A build step copies this folder into **both** apps' `public/certificate-assets/`, so the issuance app and the verification app always ship identical files.
- **Referencing:** templates reference images by a stable public path, e.g. `<img src="/certificate-assets/mora-header-v1.svg">`.
- **Verification app (Vercel):** serves the image from its own `public/` folder — it never fetches anything from the VPS, so the verify page keeps working when the VPS is down.
- **Issuance app (Puppeteer):** before rendering, the render function resolves every `/certificate-assets/...` path, reads the file from local disk, and inlines it as a base64 data URI. Puppeteer therefore never fetches anything over the network (its network access stays blocked — see §9).
- **Assets are immutable:** never rename, overwrite, or delete an existing asset file, because already-issued certificates (and older template versions) still reference it. A changed design gets a new file name (`mora-header-v2.svg`).
- **Adding a new image** requires a commit and a redeploy of **both** apps. Deploy the verification app before (or together with) any template that references the new file.
- If the source design is available as an SVG rather than a PNG, prefer that — it renders as true vector graphics, stays crisp at print resolution, and is usually smaller than a raster export. Developers should compress PNG/JPG assets before committing.

### Fonts & language

- **Language:** certificate content is **English, US spelling**, Latin script only — matching the letters MoraSpirit already issues (*organization*, *endeavors*, *honor*). No Sinhala/Tamil or other non-Latin scripts are supported. (This overrides the earlier UK-English choice: consistency with previously issued letters wins.)
- **Fonts are self-hosted assets**, never loaded from Google Fonts or any CDN and never taken from the operating system. The chosen font files (`.woff2`, every weight/style the templates use; Liberation Serif is served unsubset because the OFL reserves its name, see the `certificate-assets` README) live in `packages/certificate-assets/fonts/` alongside the images, and are shipped to both apps the same way (see above).
- Templates declare them with `@font-face` pointing at `/certificate-assets/fonts/...`. The **verify page** loads them from its own `public/` folder; **Puppeteer** inlines them as base64 data URIs before rendering, exactly like images — so the Docker image doesn't need any system fonts installed and the network stays blocked.
- Every `font-family` stack ends in a generic fallback (`serif` / `sans-serif`), but templates must not rely on it: the PDF and verify page are only guaranteed to match when the bundled fonts load.
- Font licences must allow embedding in PDFs and web use (e.g. fonts under the SIL Open Font License).
- **The existing letters use Times New Roman, which cannot be bundled** — it is Microsoft-licensed. Use a metric-compatible, freely licensable substitute so line breaks and page fit stay virtually identical: **Liberation Serif** (OFL) — chosen (decision D2, 2026-09-19); Tinos was the alternative. The substitute is chosen once and then fixed, because changing it later changes where every letter's text wraps.

### Page setup & the one-page rule

- **Page size is part of the template, not a global default.** Each template's `schema.json` declares its page setup, e.g. `"page": { "format": "Letter", "margin": "0", "printBackground": true }`. The sample letters are **US Letter (8.5 × 11 in / 612 × 792 pt)**, not A4 — Puppeteer is given these values explicitly rather than relying on its defaults, and the template CSS uses a matching `@page { size: Letter; margin: 0 }`.
- The letterhead is a **full-bleed background image** covering the whole page, so margins are zero at the PDF level and all whitespace comes from the template's own CSS padding.
- **One-page rule — a render that would spill onto a second page fails.** The letterhead artwork exists for page 1 only, so a second page would come out blank-backed and look broken. Content length genuinely varies (the "Special" letters in the sample data carry an extra bullet section), so the render function enforces this:
  1. after layout, it measures the rendered content height in the page (`document.documentElement.scrollHeight` against the page box) and, as a second guard, counts the pages of the produced PDF;
  2. if it exceeds one page, **no PDF is returned**. The admin gets a clear error naming the certificate and telling them to shorten the bullet points, e.g. *"Certificate for Dilni Muthukuda does not fit on one page (needs 2). Shorten 'special_points'."*
  3. the same check runs inside the bulk ZIP job (§6 C step 17). Failing certificates are listed in the job report with their names and reasons; the remaining certificates still render, and the ZIP is produced without the failures.
- Because the check is on rendered output, it catches long names and long bullet text alike, and it runs on every re-download — a certificate edited later can never silently start overflowing.

---

## 8. Editing Capabilities Summary

All editing happens on the **issuance app (VPS)** only — the verification app has no write access to anything.

| Method | How it works |
|---|---|
| **Manual edit (new certificate)** | Auto-generated form from the template's field schema → live client-side HTML preview → submit → backend saves + renders PDF. |
| **Manual edit (existing certificate)** | Since each certificate's values are stored as JSON, an admin can reopen and correct a previously issued record (e.g. fix a typo). Because verification always re-reads current data, the fix is reflected immediately on the verification app too. The admin must enter a reason; the old and new `data` are recorded in `certificate_audit` in the same transaction. |
| **Revoke / restore** | Admin revokes a certificate with a required reason — sets `status = revoked`, `revoked_at`, `revocation_reason`, and writes a `revoked` audit row. Restoring sets it back to `active` and writes a `restored` audit row. Certificates are never deleted. |
| **Audit history** | Each certificate's detail page in the admin panel shows its full audit trail (who changed what, when, and why). |
| **Bulk upload (`.xlsx` / `.csv`)** | Spreadsheet columns map to the template's field schema. Rows are validated before insert; optional fields (like `notable_achievements`) can be left blank and the template's conditional logic handles the rest. Re-uploaded files and rows matching existing certificates are flagged, and the admin chooses to skip or issue anyway (§6 C). Each upload is recorded in `import_batches`. |
| **Template editing** | Developer-only: a developer changes `template.hbs` / `schema.json` in the repo, and the publish script runs on deploy (§6 A). The admin can view templates and version history but cannot edit them. Every published change creates a new immutable row in `template_versions` and becomes the version used for *new* certificates. Already-issued certificates stay on the version they were issued with, so their wording, design, and required fields never change. |

---

## 9. Security Notes

- All admin routes and mutating API endpoints (issuance app only) require authentication; the verification app has no authentication because it has no privileged actions to protect.
- **Admin login (password + rate limit, no 2FA):**
  - Passwords are hashed with **argon2id** (or bcrypt, cost ≥ 12) — never stored or logged in plain text. Minimum length 12 characters.
  - **Login rate limiting:** max 5 failed attempts per email + IP per 15 minutes; after that, login is refused until the window expires. Failed attempts are stored in the `login_attempts` table (§4), not in memory, so they survive container restarts.
  - Login error messages are generic ("Invalid email or password") so they don't reveal whether an email exists.
  - Sessions use a secure, `HttpOnly`, `SameSite=Lax` cookie over HTTPS; sessions expire after 8 hours and on logout. Mutating endpoints are protected against CSRF (Auth.js / Next.js Server Actions provide this).
  - There is no public sign-up; admin accounts are created by a CLI seed script on the VPS.
  - Accepted risk: without 2FA, a leaked password gives full admin access. Mitigations are the strong password rule, rate limiting, and the audit log (§4) that records every change with the admin who made it.
- The database is reachable from both apps over the public internet now (neither is on the VPS's local network), so it needs TLS-enforced connections and a dedicated read-only DB user for the verification app, on top of whatever the provider handles by default (see §3).
- UUIDs (not sequential IDs) prevent certificate enumeration. By design there is **no** human-readable certificate number and no public search — the only way to reach a verification page is the exact UUID from the QR code / printed URL.
- The verification page shows a **summary first** — only fields flagged `public_summary` in the template's field schema (e.g. name, cert title, dates) plus status — and reveals the full certificate only when the visitor clicks "View full certificate". Revoked certificates show only the revoked status and date, never the content or revocation reason. Audit data and admin accounts are never readable by the verification app.
- **Sanitization model — sanitize field values, not the template.** Template HTML/CSS is trusted, code-reviewed developer code (§6 A), so it is **not** passed through DOMPurify (which would strip `<style>` and break the design). Instead:
  - **Plain fields** (text, date, select) are rendered with Handlebars' escaped `{{field}}` syntax, so any HTML in them is shown as text.
  - **Rich-text fields** are sanitized **when they are saved** (manual entry, edits, and every CSV row) with a strict allowlist — e.g. only `<p> <br> <strong> <em> <ul> <ol> <li>`, no attributes, no links, no images — using `sanitize-html` or `isomorphic-dompurify`. Only these pre-sanitized fields are rendered with triple-stash `{{{field}}}`.
  - Templates must not contain `<script>`, inline event handlers, or external URLs. A check in the template publish script (and CI) rejects any template that does.
  - On the verify page, the full certificate is rendered inside a sandboxed `<iframe srcdoc>` (no `allow-scripts`), so the template's CSS can't clash with the page's CSS and nothing inside it can run scripts.
- `status = revoked` gives a way to invalidate a certificate without deleting its history. Every create/edit/revoke/restore is recorded in the append-only `certificate_audit` table (see §4).
- **Public rate limiting (verification app):** Next.js middleware uses `@upstash/ratelimit` with an Upstash Redis database (free tier) on `/verify/*`:
  - Sliding window of **60 requests per minute per IP** (IP from Vercel's `x-forwarded-for` / `request.ip`). Over the limit → HTTP `429` with a short "Too many requests, try again in a minute" page and a `Retry-After` header.
  - Runs **before** the database query, so a blocked request never touches MySQL.
  - **Fails open:** if Upstash is unreachable or times out (e.g. > 500 ms), the request is allowed through. Rate limiting must never take the verify page down — keeping it reachable is the whole point of the split.
  - Upstash credentials (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) exist only in the verification app's Vercel environment variables. Choose an Upstash region close to the Vercel function region.
  - Invalid UUID formats are rejected with a `404` before the database query, so random junk paths cost nothing.
- HTTPS everywhere, including the QR-encoded URL and the database connection string itself.
- **Puppeteer lockdown (issuance app):** JavaScript is disabled on render pages, and request interception aborts every request that isn't a `data:` URI (images are already inlined, §7), so a template or field value can never make the VPS fetch an external or internal URL (SSRF). Rendering uses a small reused browser with a capped number of concurrent pages and a per-render timeout.

---

## 10. Hosting

**VPS (Docker):**
- The issuance Next.js app, with Puppeteer/Chromium available in the same container/image.
- Inngest — starts on their managed free-tier cloud (zero extra infra), with self-hosting on the same VPS as an option later if desired. Inngest Cloud calls the app's `/api/inngest` endpoint over HTTPS, so that endpoint must be publicly reachable and protected by Inngest's signing key. Used for bulk ZIP generation and the 24-hour ZIP cleanup cron.
- A dedicated Docker volume for temporary ZIP exports (e.g. `/data/tmp-exports`), never exposed as a public static folder.
- No database here anymore — it connects out to the managed provider over TLS, same as Vercel does.

**Vercel:**
- The verification-only Next.js app, with its own Prisma client connecting directly to the managed MySQL provider. No Docker, no Puppeteer — just a thin app that queries the database and renders the result on every request (no caching). Functions run in the same region as the database, scale automatically for public traffic, and keep working even if the VPS is temporarily down.
- Rate limiting via Next.js middleware + **Upstash Redis** (free tier, separate account/service), failing open if Upstash is unavailable (see §9).

**Managed MySQL-compatible provider (to be chosen against the requirements in §3):**
- The database itself — backups, patching, and TLS certificates are the provider's responsibility, not yours.
- Two separate connection strings/users issued: full read/write for the issuance app, read-only for the verification app.

### Schema extras and render-context variables (as built)

- A field may carry `default` (text, date and select fields). `applyDefaults()` in `packages/shared` fills missing or blank values from it; the sample spreadsheet has no signatory columns, so the importer relies on this.
- `schema.json` is `{ "name": ..., "fields": [...] }` and is validated by `parseTemplateSchemaFile()` (unknown keys, duplicate names, bad types and list defaults are rejected).
- Besides the schema fields, `renderCertificateHtml` provides the derived pronouns (`pronoun_subject`, `Pronoun_subject`, `pronoun_object`, `pronoun_possessive` and capitalized forms, plus the `verb` helper) and, when the caller passes `qr`, `verify_qr` (a data URI) and `verify_url`. Without `qr` (previews) the templates draw a dashed placeholder box. Derived and reserved names always win over data with the same key.
- Templates in `packages/certificate-templates/`: `moraspirit-service-letter` (standard wording) and `moraspirit-service-letter-outstanding` (the longer wording, decision D3). Both use the single full-page `mora-letterhead-v1.jpg` as a background, US Letter, 12 pt Liberation Serif, and mark the printable text area `#letter-body` (the one-page rule measures it, Phase 3).
- The lead-in sentence for `special_points` in the standard template ("made the following notable contributions") is new wording, not from the samples, which have no such sentence. MoraSpirit should confirm it.

