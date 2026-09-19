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

`fonts/` will hold Liberation Serif (SIL OFL 1.1), the Times New Roman substitute
chosen in decision D2. Added in P1-12.
