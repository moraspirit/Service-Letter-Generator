# certificate-assets

Images and fonts that certificate templates reference as `/certificate-assets/<file>`.
Files here are **immutable**: issued certificates reference them, so never rename,
overwrite or delete one. A changed design gets a new file (`...-v2.jpg`).

## Letterhead

| File | Size | Use |
|---|---|---|
| `mora-header-v1.jpg` | 1822 x 540 | Top 21% of the MoraSpirit letterhead: wave, logo |
| `mora-footer-v1.jpg` | 1822 x 773 | Bottom 31%: globe watermark, contact block, red bar |

Both are slices of one letterhead image (extracted from the two sample service
letters, which embed identical artwork; the larger copy was used). Slicing lets
the template place the header at the top and the footer at the bottom of a **US
Letter** page at full width without stretching. The source artwork is A4-shaped
(1:1.414), Letter is 1:1.294, so a single full-page image would either distort or
crop. The slices are cut on pure-white rows, so the middle stays plain white.

Templates position them absolutely behind the body text. The globe watermark is
faint enough to sit under text; the contact block starts about 1.1 in above the
bottom edge, so keep body content clear of it.

Licence: MoraSpirit brand artwork, used with the owner's permission. Not for reuse elsewhere.

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
