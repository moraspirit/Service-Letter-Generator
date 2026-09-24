"use client";

import { useMemo, useRef, useSyncExternalStore } from "react";
import { parseQueue, QUEUE_EVENT, QUEUE_PREFIX, type FixQueue } from "./fix-queue";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange); // other tabs
  window.addEventListener(QUEUE_EVENT, onChange); // this tab
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(QUEUE_EVENT, onChange);
  };
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(QUEUE_PREFIX + key);
  } catch {
    return null; // storage blocked: the queue simply is not there
  }
}

/**
 * The queue for `key`, or null on the server, before hydration, when the key is unknown, or
 * when it has expired. With `keepLast`, a queue that disappears (removed once finished, or
 * expired) keeps showing its last known state, so the import report still reads correctly.
 */
export function useFixQueue(key: string | null, keepLast = false): FixQueue | null {
  const json = useSyncExternalStore(
    subscribe,
    () => (key ? read(key) : null),
    () => null,
  );
  const last = useRef<FixQueue | null>(null);
  const queue = useMemo(() => parseQueue(json), [json]);
  if (queue) last.current = queue;
  else if (!keepLast || !key) last.current = null;
  return queue ?? (keepLast ? last.current : null);
}

export function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
