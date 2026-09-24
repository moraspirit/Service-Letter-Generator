# Design

The visual system both apps render. Tokens and component classes live in
`packages/ui/src/tokens.css`; the primitives that use them live in
`packages/ui/src/`. Strategy, users and principles are in [PRODUCT.md](PRODUCT.md).

**Rule:** component styling belongs to the `ms-*` classes in the shared
stylesheet. Tailwind utilities are for page-level layout inside an app only —
never inside `packages/ui`, which neither app's Tailwind scans.

---

## Theme

**Light only.** There is no dark theme and no `prefers-color-scheme` block; adding
one means designing and contrast-checking a second full set.

The scene the theme is built for: an admin at a laptop in a university common
room, and a stranger holding a printed letter outdoors, squinting at a phone. Both
want maximum legibility and no ambiguity. A tinted near-white surface with
near-black text serves both; a dark theme would serve neither.

## Color

Anchored on MoraSpirit's own red, sampled from the letterhead artwork
(`packages/certificate-assets/mora-letterhead-v1.jpg`): **`#e73529` =
`oklch(60.7% 0.215 29)`**. Everything is OKLCH.

Strategy: **Restrained.** Red carries identity and the primary action; the rest of
the surface is a tinted neutral ramp. Neutrals take 0.002–0.018 chroma at the
brand's own hue (29), so greys read as MoraSpirit's greys rather than stock zinc.

### Ramp

| Token | Value | Job |
|---|---|---|
| `--ms-brand-500` | `oklch(62.8% 0.212 29)` | The letterhead red. Non-text only: rules, markers. |
| `--ms-brand-600` | `oklch(56.5% 0.205 29)` | Primary fill. White on it = **5.04:1**. |
| `--ms-brand-700` | `oklch(49.5% 0.18 29)` | Links, danger text, primary hover. **6.60:1**. |
| `--ms-brand-800` | `oklch(41.5% 0.148 29)` | Badge text on `brand-50`. **8.31:1**. |
| `--ms-bg-0 / 1 / 2` | `99.2% / 97.4% / 95.5%` | Page / raised panel / sunken well and table head. |
| `--ms-line` | `oklch(88.7% 0.009 29)` | Default border (decorative). |
| `--ms-field-line` | `oklch(62.5% 0.014 29)` | Control boundary. **3.50:1** — SC 1.4.11. |
| `--ms-ink-muted` | `oklch(53% 0.016 29)` | Labels, helper text, placeholders. **5.18:1**. |
| `--ms-ink-soft` | `oklch(44% 0.018 29)` | Secondary text. **7.66:1**. |
| `--ms-ink` | `oklch(30% 0.018 29)` | Body. **13.39:1**. |
| `--ms-ink-strong` | `oklch(22% 0.016 29)` | Headings. **16.97:1**. |

Semantic states each carry a foreground, a background and a line:
`ok` (green, 152°), `warn` (amber, 75–85°), `info` (blue, 255°), and `bad`, which
reuses the brand reds. Every pairing clears 6:1.

### The two jobs red does

Red is both MoraSpirit's brand colour and the conventional danger colour. They are
kept apart by **fill versus outline**, not by hue:

- **Primary actions are a solid red fill** — Issue, Save, Import, Download.
- **Destructive actions are a red outline inside a bordered danger area** —
  Revoke. Never a red fill.

Placement and shape carry the distinction; the required typed reason is the actual
safeguard.

### Rules

- Verified contrast, not assumed. Body ≥ 4.5:1, large/non-text ≥ 3:1. Helper text
  and placeholders are held to the **body** ratio, not a muted default.
- Status is never colour alone. Every pill and verdict pairs a colour with an icon
  and a word.
- `--ms-ink-faint` is decorative only and must never carry text.

## Typography

**Inter**, one family, via `next/font/google` in both apps. Product UI does not
need a display/body pairing. System mono (`ui-monospace`) for UUIDs and member IDs
— no second webfont.

Fixed rem steps, ratio ~1.15 — not `clamp()`. Users view at a consistent DPI, and a
fluid heading only misbehaves inside a narrow rail.

| Token | Size | Use |
|---|---|---|
| `--ms-text-2xs` | 11px | Pill text |
| `--ms-text-sm` | 13px | Helper text, labels, table body |
| `--ms-text-base` | 15px | UI body, buttons, inputs |
| `--ms-text-md` | 17px | Fact values |
| `--ms-text-xl` | 24px | Page titles, verdict on phones |
| `--ms-text-3xl` | 34px | Verify verdict from 480px up |

- Headings: weight 650, `letter-spacing: -0.015em`. Never tighter than -0.04em.
- `text-wrap: balance` on headings, `pretty` on prose. The verify verdict overrides
  to `pretty` — `balance` splits short verdicts into lopsided lines.
- `.ms-tnum` for tabular numerals in tables, counts and IDs.
- Prose capped at 65–75ch (`.ms-pagehead-sub` at 68ch).

## Layout

- Admin shell: sticky top bar (four destinations do not earn a sidebar, and the
  tables want the width), `max-width: 78rem`.
- Verify: a single centred column, `max-width: 46rem`, no navigation at all.
- Every admin screen opens with `PageHeader` — breadcrumb, title, subtitle,
  action bar. The subtitle is not decoration: this tool is used a handful of times
  a year, so each screen states what it does.
- Two-up layouts (`.ms-detail`, `.ms-issue`) collapse at 64rem; the import rail at
  60rem. Responsive behaviour is structural, never fluid type.
- `repeat(auto-fit, minmax(...))` for card rows, so they reflow without breakpoints.
- Cards: `--ms-radius-lg` (12px) maximum. A card gets a border **or** a shadow,
  never both as decoration. Nested cards are never correct.

## Components

Shared (`@moraspirit/ui`, used by both apps): `Button`, `LinkButton`, `Card` /
`CardHead` / `CardBody`, `StatusPill`, `CertificateStatusPill`, `Banner`,
`DescriptionList`, `EmptyState`, `Icon`. Admin-only components live in
`apps/issuance/app/_components/`.

- **Button** — one geometry; variants differ by fill only. `primary` (red fill),
  `secondary` (outline), `ghost`, `danger` (red outline).
- **Field** — `.ms-field` wraps label, control, helper and error. Required fields
  carry a red `*`; optional ones say "(optional)". Errors use `aria-invalid` plus
  an icon and text, wired with `aria-describedby`.
- **Step rail** — `.ms-steps`, used **only** on `/imports/new`, where Choose file →
  Review → Import is genuine sequence. It is not applied to the issue form, whose
  live preview depends on everything being on one screen.
- **Table rows** — a row that opens a detail page is a stretched link: the row's
  one `.ms-cell-link` covers the whole row (`::after`), so a click anywhere
  navigates while Ctrl/Cmd-click and keyboard focus keep working. The focus ring
  goes round the row. Every enabled interactive element gets `cursor: pointer`
  from one rule in `tokens.css`; disabled ones keep `not-allowed`.
- **Danger zone** — full border with a tinted header. Never a left stripe.
- **Empty states** teach the workflow and offer the action, rather than saying
  "nothing here".
- **Icons** — one inline SVG set on a 24×24 grid, 2px stroke. Decorative by
  default; anything meaningful is paired with visible text.

## Motion

150–240ms, `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out-quart). No bounce.

Motion conveys state only: hover and focus transitions, pending button labels, the
ZIP progress bar, table row hover. There is no page-load choreography — the admin
is mid-task and should not watch the tool arrive.

`prefers-reduced-motion: reduce` collapses every transition to 0.01ms, globally, in
the shared stylesheet.

## Accessibility

Target **WCAG 2.2 AA**, verified rather than assumed.

- Visible focus on everything focusable: 2px `brand-600` outline, 2px offset.
- Control boundaries ≥ 3:1 (`--ms-field-line`, 3.50:1) — SC 1.4.11.
- Skip link on the admin shell; `<main id="main">` on every page.
- Tables carry `<caption class="sr-only">` and `scope="col"` headers.
- Audit diffs use `<del>`/`<ins>`, so the change survives without colour.
- No horizontal scroll at 360px on any screen, both apps.

## Things this system does not do

- No dark mode.
- No gradient text, glassmorphism, side-stripe borders, or hero metric tiles.
- No modals — every flow is inline or a page.
- No decorative motion.
- No card radius above 12px.
- No Tailwind utilities inside `packages/ui`.
- No template-literal `className` concatenation: the Tailwind Prettier plugin
  strips leading spaces inside them and silently fuses class names. Use `cx()`.
