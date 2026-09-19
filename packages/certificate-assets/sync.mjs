// Copies this package's assets into an app's public/certificate-assets/ so the
// issuance and verify apps ship identical files. The destination is generated
// (git-ignored) and is rebuilt from scratch on every run.
//
// Usage: node ../../packages/certificate-assets/sync.mjs public/certificate-assets

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const source = path.dirname(fileURLToPath(import.meta.url));
const NOT_ASSETS = new Set(["package.json", "README.md", "sync.mjs", "node_modules"]);

const destinations = process.argv.slice(2);
if (destinations.length === 0) {
  console.error("Usage: node sync.mjs <destination-dir> [...]");
  process.exit(1);
}

const entries = readdirSync(source).filter((name) => !NOT_ASSETS.has(name));

for (const destination of destinations) {
  const target = path.resolve(process.cwd(), destination);
  // Refuse to wipe anything that is not a certificate-assets folder.
  if (path.basename(target) !== "certificate-assets") {
    console.error(`Refusing to sync into "${target}": folder must be named certificate-assets`);
    process.exit(1);
  }
  if (existsSync(target)) rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  for (const name of entries) {
    cpSync(path.join(source, name), path.join(target, name), { recursive: true });
  }
  console.log(`certificate-assets: copied ${entries.length} entries to ${target}`);
}
