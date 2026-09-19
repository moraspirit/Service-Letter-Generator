// Node-only helpers (issuance app / Puppeteer). Kept out of the main entry so the
// browser preview and the verify page never import node:fs.
import { readFileSync } from "node:fs";
import path from "node:path";
import { ASSET_PREFIX, type AssetResolver } from "./assets";

const MIME: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
};

/**
 * Builds a resolver that inlines each asset as a base64 data URI, read from
 * `assetsDir` (the folder served as `/certificate-assets/`). Puppeteer never
 * fetches anything: all its non-`data:` requests are blocked.
 */
export function createDataUriResolver(assetsDir: string): AssetResolver {
  const root = path.resolve(assetsDir);
  return (assetPath) => {
    const relative = assetPath.slice(ASSET_PREFIX.length);
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep)) {
      throw new Error(`Asset path escapes the assets folder: ${assetPath}`);
    }
    const mime = MIME[path.extname(file).toLowerCase()];
    if (!mime) throw new Error(`Unsupported asset type: ${assetPath}`);
    let bytes: Buffer;
    try {
      bytes = readFileSync(file);
    } catch {
      throw new Error(`Missing certificate asset: ${assetPath}`);
    }
    return `data:${mime};base64,${bytes.toString("base64")}`;
  };
}
