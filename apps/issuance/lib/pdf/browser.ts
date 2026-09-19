// One long-lived headless browser shared by every render, with a cap on how many
// pages render at once. Chromium comes from the machine (CHROMIUM_PATH, or a
// well-known install location), not from a download.
import { existsSync } from "node:fs";
import puppeteer, { type Browser } from "puppeteer-core";

const CANDIDATES = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

export class ChromiumNotFoundError extends Error {
  constructor() {
    super("No Chromium/Chrome/Edge found. Install one or set CHROMIUM_PATH.");
  }
}

function executablePath(): string {
  const configured = process.env.CHROMIUM_PATH;
  if (configured) {
    if (!existsSync(configured)) throw new Error(`CHROMIUM_PATH does not exist: ${configured}`);
    return configured;
  }
  const found = CANDIDATES.find((p) => existsSync(p));
  if (!found) throw new ChromiumNotFoundError();
  return found;
}

const MAX_CONCURRENT_PAGES = 2;

interface PoolState {
  browser?: Promise<Browser>;
  active: number;
  waiters: (() => void)[];
}

const globalForPool = globalThis as unknown as { __moraspiritPdfPool?: PoolState };
const pool: PoolState = (globalForPool.__moraspiritPdfPool ??= { active: 0, waiters: [] });

function launch(): Promise<Browser> {
  const extra = (process.env.CHROMIUM_EXTRA_ARGS ?? "").split(/\s+/).filter(Boolean);
  const args = [
    "--disable-gpu",
    "--font-render-hinting=none",
    // Only inside a container that runs as root (Phase 8). Never set on a workstation.
    ...(process.env.CHROMIUM_NO_SANDBOX === "1" ? ["--no-sandbox"] : []),
    ...extra,
  ];
  const promise = puppeteer.launch({ executablePath: executablePath(), headless: true, args });
  promise.then(
    (browser) =>
      browser.on("disconnected", () => {
        if (pool.browser === promise) pool.browser = undefined;
      }),
    () => {
      if (pool.browser === promise) pool.browser = undefined;
    },
  );
  return promise;
}

async function acquireSlot(): Promise<void> {
  if (pool.active < MAX_CONCURRENT_PAGES) {
    pool.active++;
    return;
  }
  await new Promise<void>((resolve) => pool.waiters.push(resolve));
}

function releaseSlot(): void {
  const next = pool.waiters.shift();
  if (next)
    next(); // hand the slot straight to the next waiter
  else pool.active--;
}

/** Runs `work` with a fresh page, respecting the concurrency cap. The page is always closed. */
export async function withPage<T>(
  work: (page: import("puppeteer-core").Page) => Promise<T>,
): Promise<T> {
  await acquireSlot();
  try {
    pool.browser ??= launch();
    const browser = await pool.browser;
    const page = await browser.newPage();
    try {
      return await work(page);
    } finally {
      await page.close().catch(() => undefined);
    }
  } finally {
    releaseSlot();
  }
}

/** For tests and graceful shutdown. */
export async function closeBrowser(): Promise<void> {
  const current = pool.browser;
  pool.browser = undefined;
  if (current) await (await current).close().catch(() => undefined);
}
