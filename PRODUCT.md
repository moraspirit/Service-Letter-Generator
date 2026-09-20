# Product

## Register

product

## Users

Two audiences that never meet, on opposite sides of the same database.

**The issuing admin** — a MoraSpirit committee member, on a laptop, working in bursts near the end of a project cycle. They are not a daily user: they sign in a handful of times a year, issue or import a batch of service letters, then leave. Because the gap between sessions is months, the interface cannot rely on remembered knowledge. Their jobs: issue one letter, import a spreadsheet of 30-40, download a ZIP for distribution, and correct or revoke a letter when something turns out wrong.

**The verifier** — an employer, university admissions officer or scholarship reviewer holding a printed letter, scanning its QR code on a phone, often in a hurry and in imperfect light. They have no account, no context and no patience. Their single job: find out whether this letter is genuine. They arrive once and leave in seconds.

## Product Purpose

MoraSpirit issues "Certificate of Employment" service letters to volunteers. A printed letter is trivially forgeable, so each one carries a QR code pointing at a public page that checks it against the live record. The system exists to make that claim checkable by a stranger.

Success is narrow and measurable: a verifier reaches a correct verdict in under five seconds, and an admin issues a correct batch without needing anyone to explain the tool to them.

## Brand Personality

**Official, plain-spoken, unfussy.**

MoraSpirit's identity is a vivid red with charcoal on white — it appears on the letterhead and on nothing else in the system. The web surfaces borrow that red sparingly; they are the infrastructure behind a formal document, not a second brand.

Voice is administrative and direct. "This certificate is valid." "This certificate was revoked on 4 May 2026." Never chatty, never reassuring beyond the facts, never apologetic. On the verify page the tone carries institutional weight, because the reader is deciding whether to trust a document.

The admin panel's personality is competence: it should feel like a tool someone built carefully for a job they understood, and should disappear into the task.

## Anti-references

- **Generic SaaS dashboard.** No hero metric tiles, no gradient cards, no "Welcome back 👋", no sparkline-for-decoration. This is an internal records tool, not a growth product.
- **Certificate-mill aesthetics.** Gold foil, seals, ornate borders, script fonts, badge imagery. The letter itself is the formal object; the verification page must read as a database lookup, because that is exactly what gives it authority.
- **Consumer trust theater.** Animated checkmarks, confetti, "🔒 Bank-level security" padding. A verdict states itself.
- **The current admin UI**, which is unstyled Next.js defaults: raw Tailwind utilities scattered inline, no component vocabulary, inconsistent spacing.
- **Cream/sand/parchment backgrounds.** The warm near-white band reads as an AI default, and here it would also mimic paper, which muddles the distinction between the page and the letter it displays.

## Design Principles

1. **The verdict outranks everything.** On the public page, the single most important fact — valid, revoked, or not found — is the first thing seen and the only thing that needs no reading. Supporting detail is subordinate in size, weight and position.

2. **Show the record, not a reassurance.** Authority comes from specificity: a name, a member ID, dates, a pinned template version. Generic trust language is weaker than a fact.

3. **Destructive actions require a sentence, not a color.** Revoking and editing already demand a typed reason. The interface leans on that friction and on clear placement rather than on alarm styling, which users learn to click past.

4. **Design for the infrequent user.** Every screen states where you are and what happens next. Empty states teach the workflow. No affordance depends on having used the tool before.

5. **The two apps look related but never merge.** They share tokens, type and components so a verifier recognizes the same institution, but the verify app stays a single public page with no navigation, no account surface and no route that hints an admin panel exists.

## Accessibility & Inclusion

Target: **WCAG 2.2 AA**, verified rather than assumed.

- Body text ≥ 4.5:1; large text ≥ 3:1. Placeholder and label text held to the body ratio, not a muted default.
- Non-text UI contrast ≥ 3:1 (SC 1.4.11): input borders, focus indicators, control boundaries.
- Visible, non-color focus indicator on every interactive element; full keyboard paths through every flow.
- Status is never carried by color alone — each state pairs its color with an icon and a word.
- `prefers-reduced-motion: reduce` honored on every transition.
- The verify page must stay usable one-handed on a 360 px phone in daylight, and legible at 200% zoom.
