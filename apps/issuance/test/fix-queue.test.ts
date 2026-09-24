import { describe, expect, it } from "vitest";
import {
  createQueue,
  isQueueKey,
  neighbours,
  nextRow,
  QUEUE_PREFIX,
  QUEUE_TTL_MS,
  readQueue,
  remaining,
  setRowStatus,
  sweepExpired,
  type KeyValueStorage,
} from "../lib/fix-queue";

class MemoryStorage implements KeyValueStorage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

const rows = [7, 3, 12].map((n) => ({
  rowNumber: n,
  label: `Person ${n}`,
  raw: { member_id: `X${n}` },
  errors: { honorific: "Gender is required" },
}));

function make(storage = new MemoryStorage(), now = 1_000) {
  const key = createQueue(storage, { templateId: 5, fileName: "f.xlsx", rows }, now);
  return { storage, key, now };
}

describe("fix queue", () => {
  it("creates a random key that passes the URL check, with rows sorted and open", () => {
    const { storage, key, now } = make();
    expect(isQueueKey(key)).toBe(true);
    const queue = readQueue(storage, key, now)!;
    expect(queue.rows.map((r) => r.rowNumber)).toEqual([3, 7, 12]);
    expect(queue.rows.every((r) => r.status === "open")).toBe(true);
    expect(queue.templateId).toBe(5);
  });

  it("rejects malformed keys", () => {
    expect(isQueueKey("../x")).toBe(false);
    expect(isQueueKey("ABC")).toBe(false);
    expect(isQueueKey(undefined)).toBe(false);
  });

  it("expires after an hour and removes the stale entry", () => {
    const { storage, key, now } = make();
    expect(readQueue(storage, key, now + QUEUE_TTL_MS)).not.toBeNull();
    expect(readQueue(storage, key, now + QUEUE_TTL_MS + 1)).toBeNull();
    expect(storage.getItem(QUEUE_PREFIX + key)).toBeNull();
  });

  it("sweeps expired queues but leaves live ones and unrelated keys", () => {
    const storage = new MemoryStorage();
    const old = createQueue(storage, { templateId: 5, fileName: "a", rows }, 0);
    const live = createQueue(storage, { templateId: 5, fileName: "b", rows }, QUEUE_TTL_MS);
    storage.setItem("something-else", "keep");
    sweepExpired(storage, QUEUE_TTL_MS + 10);
    expect(storage.getItem(QUEUE_PREFIX + old)).toBeNull();
    expect(storage.getItem(QUEUE_PREFIX + live)).not.toBeNull();
    expect(storage.getItem("something-else")).toBe("keep");
  });

  it("records issued rows with the certificate id and counts what is left", () => {
    const { storage, key, now } = make();
    const queue = setRowStatus(storage, key, 7, "issued", "cert-1", now)!;
    expect(queue.rows.find((r) => r.rowNumber === 7)).toMatchObject({
      status: "issued",
      certificateId: "cert-1",
    });
    expect(remaining(queue)).toBe(2);
    expect(readQueue(storage, key, now)!.rows.find((r) => r.rowNumber === 7)!.status).toBe(
      "issued",
    );
  });

  it("finds the next row: later open ones, then earlier open ones, then skipped ones", () => {
    const { storage, key, now } = make();
    setRowStatus(storage, key, 7, "issued", "c", now);
    const queue = readQueue(storage, key, now)!;
    expect(nextRow(queue, 3)?.rowNumber).toBe(12);
    expect(nextRow(queue, 12)?.rowNumber).toBe(3);

    setRowStatus(storage, key, 3, "skipped", undefined, now);
    setRowStatus(storage, key, 12, "issued", "c2", now);
    const left = readQueue(storage, key, now)!;
    expect(nextRow(left, 12)?.rowNumber).toBe(3);
    expect(nextRow(left, 3, 3)).toBeNull();
  });

  it("gives previous and next neighbours by position", () => {
    const { storage, key, now } = make();
    const queue = readQueue(storage, key, now)!;
    expect(neighbours(queue, 3)).toMatchObject({ index: 0, previous: null });
    expect(neighbours(queue, 7).previous?.rowNumber).toBe(3);
    expect(neighbours(queue, 7).next?.rowNumber).toBe(12);
    expect(neighbours(queue, 12).next).toBeNull();
    expect(neighbours(queue, 99).index).toBe(-1);
  });

  it("returns null for a missing or corrupt entry", () => {
    const storage = new MemoryStorage();
    expect(readQueue(storage, "nokey1234", 0)).toBeNull();
    storage.setItem(QUEUE_PREFIX + "badbad1234", "{not json");
    expect(readQueue(storage, "badbad1234", 0)).toBeNull();
  });
});
