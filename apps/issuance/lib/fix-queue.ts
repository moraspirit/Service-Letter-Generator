// The fix queue: failed import rows, handed from the import report to the manual issue form.
//
// It lives in the admin's own browser (localStorage) and nowhere else: recipient names must
// not go in a URL, and storing rejected rows on the server would need a migration for data we
// would rather not keep. The URL carries only a random key. Entries expire after an hour and
// are removed once every row has been issued.
//
// No React and no `window` in here: the storage is passed in, so this is plain and testable.

export const QUEUE_PREFIX = "ms-fix-queue:";
export const QUEUE_TTL_MS = 60 * 60 * 1000;
export const QUEUE_EVENT = "ms-fix-queue-change";

export type RowStatus = "open" | "issued" | "skipped";

export interface QueueRow {
  rowNumber: number;
  /** Member id and name as typed, so the admin can recognise the row. */
  label: string;
  /** The spreadsheet values as typed (form values: lists are one item per line). */
  raw: Record<string, string>;
  /** Field name -> what to fix. `_render` is a problem that belongs to no single field. */
  errors: Record<string, string>;
  status: RowStatus;
  certificateId?: string;
}

export interface FixQueue {
  v: 1;
  templateId: number;
  fileName: string;
  createdAt: number;
  rows: QueueRow[];
}

export interface KeyValueStorage {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const KEY_PATTERN = /^[a-z0-9]{8,32}$/;

export function isQueueKey(value: unknown): value is string {
  return typeof value === "string" && KEY_PATTERN.test(value);
}

function newKey(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => (b % 36).toString(36)).join("");
}

export function parseQueue(json: string | null, now = Date.now()): FixQueue | null {
  if (!json) return null;
  try {
    const queue = JSON.parse(json) as FixQueue;
    if (queue?.v !== 1 || !Array.isArray(queue.rows)) return null;
    if (now - queue.createdAt > QUEUE_TTL_MS) return null;
    return queue;
  } catch {
    return null;
  }
}

export function readQueue(
  storage: KeyValueStorage,
  key: string,
  now = Date.now(),
): FixQueue | null {
  const queue = parseQueue(storage.getItem(QUEUE_PREFIX + key), now);
  if (!queue) storage.removeItem(QUEUE_PREFIX + key);
  return queue;
}

/** Remove every queue that has expired, including any that no longer parse. */
export function sweepExpired(storage: KeyValueStorage, now = Date.now()): void {
  const stale: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const name = storage.key(i);
    if (name?.startsWith(QUEUE_PREFIX) && !parseQueue(storage.getItem(name), now)) stale.push(name);
  }
  stale.forEach((name) => storage.removeItem(name));
}

export function createQueue(
  storage: KeyValueStorage,
  input: { templateId: number; fileName: string; rows: Omit<QueueRow, "status">[] },
  now = Date.now(),
): string {
  sweepExpired(storage, now);
  const key = newKey();
  const queue: FixQueue = {
    v: 1,
    templateId: input.templateId,
    fileName: input.fileName,
    createdAt: now,
    rows: input.rows
      .map((r) => ({ ...r, status: "open" as const }))
      .sort((a, b) => a.rowNumber - b.rowNumber),
  };
  storage.setItem(QUEUE_PREFIX + key, JSON.stringify(queue));
  return key;
}

export function setRowStatus(
  storage: KeyValueStorage,
  key: string,
  rowNumber: number,
  status: RowStatus,
  certificateId?: string,
  now = Date.now(),
): FixQueue | null {
  const queue = readQueue(storage, key, now);
  if (!queue) return null;
  const row = queue.rows.find((r) => r.rowNumber === rowNumber);
  if (!row) return queue;
  row.status = status;
  if (certificateId) row.certificateId = certificateId;
  storage.setItem(QUEUE_PREFIX + key, JSON.stringify(queue));
  return queue;
}

export function removeQueue(storage: KeyValueStorage, key: string): void {
  storage.removeItem(QUEUE_PREFIX + key);
}

/** Rows still to fix: open ones first (after `after`, then from the top), then skipped ones. */
export function nextRow(queue: FixQueue, after: number | null, exclude?: number): QueueRow | null {
  const candidates = queue.rows.filter((r) => r.rowNumber !== exclude);
  const open = candidates.filter((r) => r.status === "open");
  const later = open.find((r) => after !== null && r.rowNumber > after);
  return later ?? open[0] ?? candidates.find((r) => r.status === "skipped") ?? null;
}

export function remaining(queue: FixQueue): number {
  return queue.rows.filter((r) => r.status !== "issued").length;
}

export function neighbours(
  queue: FixQueue,
  rowNumber: number,
): { index: number; previous: QueueRow | null; next: QueueRow | null } {
  const index = queue.rows.findIndex((r) => r.rowNumber === rowNumber);
  return {
    index,
    previous: index > 0 ? queue.rows[index - 1] : null,
    next: index >= 0 && index < queue.rows.length - 1 ? queue.rows[index + 1] : null,
  };
}

/** Same-tab writes do not fire `storage`, so the readers listen for this as well. */
export function notifyChange(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(QUEUE_EVENT));
}
