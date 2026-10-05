# certificate-assets

Images and fonts that certificate templates reference as `/certificate-assets/<file>`.
Files here are **immutable**: issued certificates reference them, so never rename,
overwrite or delete one. A changed design gets a new file (`...-v2.jpg`).

## Letterhead

| File | Size | Use |
|---|---|---|
| `mora-logo-v1.png` | 262 x 260 | The MoraSpirit logo (shark and wordmark), cropped from the letterhead. Used in both apps' navbars, never in a letter |
| `mora-letterhead-v1.jpg` | 1865 x 2415 | Full-page MoraSpirit letterhead: wave and logo at the top, globe watermark, contact block and red bar at the bottom |

Extracted from the current service-letter PDF (the one with the 2026 contact
block). Its aspect ratio is exactly US Letter (8.5 x 11 in), so a template can use
it as a full-bleed background with `background-size: 100% 100%` and no distortion.

The contact block prints office-bearers' names and phone numbers. When they change,
add `mora-letterhead-v2.jpg` and publish a new template version; certificates already
issued keep the old artwork.

Layout notes for templates: the header wave ends about 1.9 in from the top on the
right and the logo sits at the top left; the contact block starts about 1.2 in above
the bottom edge. The globe watermark is faint and can sit under body text.

## Fonts

**Liberation Serif 2.1.5** (Regular, Bold, Italic, Bold Italic) in `fonts/`, the
Times New Roman substitute chosen in decision D2. Times New Roman is
Microsoft-licensed and must never be added here.

- Source: the official release tarball `liberation-fonts-ttf-2.1.5` from
  <https://github.com/liberationfonts/liberation-fonts> (release 2.1.5).
- Licence: SIL Open Font License 1.1 (`fonts/LICENSE-Liberation.txt`, authors in
  `fonts/AUTHORS-Liberation.txt`). Copyright Google Corporation and Red Hat, Inc.
- The files are a **lossless WOFF2 conversion** of the original TTFs (same glyphs,
  same metrics, same internal font name). They are deliberately **not subset**: the
  OFL reserves the name "Liberation", so a subsetted (modified) font would have to
  be renamed. Do not subset or edit these files; if you must, rename the font first.
- Versioned file names (`-v2.1.5`) keep them immutable like every other asset here.
