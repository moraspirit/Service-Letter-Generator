export const ASSET_PREFIX = "/certificate-assets/";

/** Maps an absolute asset path (e.g. `/certificate-assets/mora-header-v1.svg`) to what the HTML should reference. */
export type AssetResolver = (assetPath: string) => string;

const ASSET_REF = /\/certificate-assets\/[A-Za-z0-9._\-/]+/g;

/**
 * Rewrites every `/certificate-assets/...` reference in rendered HTML. Without a
 * resolver the paths are left as they are, for the browser (preview, verify page)
 * which serves them from `public/`. Puppeteer passes a data-URI resolver.
 */
export function resolveAssets(html: string, resolver?: AssetResolver): string {
  if (!resolver) return html;
  return html.replace(ASSET_REF, (path) => resolver(path));
}
