"use client";

import { useEffect } from "react";
import { Banner, LinkButton } from "@moraspirit/ui";
import { nextRow, notifyChange, remaining, removeQueue, setRowStatus } from "@/lib/fix-queue";
import { browserStorage, useFixQueue } from "@/lib/use-fix-queue";
import { fixHref } from "../_components/fix-queue-banner";

/**
 * Shown after a row from the import fix queue was issued by hand: records it as issued,
 * says how many are left, and offers the next one. Once the last row is done the queue is
 * removed, so recipient names do not stay in the browser.
 */
export function FixQueueNotice({
  queueKey,
  rowNumber,
  certificateId,
}: {
  queueKey: string;
  rowNumber: number;
  certificateId: string;
}) {
  const queue = useFixQueue(queueKey);
  const row = queue?.rows.find((r) => r.rowNumber === rowNumber);
  const alreadyIssued = row?.status === "issued";

  // Record the row as issued (idempotent: a reload does nothing more).
  useEffect(() => {
    if (!row || alreadyIssued) return;
    const storage = browserStorage();
    if (!storage) return;
    setRowStatus(storage, queueKey, rowNumber, "issued", certificateId);
    notifyChange();
  }, [row, alreadyIssued, queueKey, rowNumber, certificateId]);

  const left = queue ? remaining(queue) : 0;
  const following = queue ? nextRow(queue, rowNumber, rowNumber) : null;
  const finished = Boolean(queue) && alreadyIssued && left === 0;

  // Everything is issued: nothing personal needs to stay in this browser any longer.
  useEffect(() => {
    if (!finished) return;
    const storage = browserStorage();
    if (!storage) return;
    removeQueue(storage, queueKey);
    notifyChange();
  }, [finished, queueKey]);

  if (!queue && !alreadyIssued) return null;

  if (finished || !following) {
    return (
      <Banner tone="ok" title={`Row ${rowNumber} issued`}>
        <p>
          {left === 0
            ? "That was the last failed row. You can close this tab and go back to the import."
            : `${left} failed ${left === 1 ? "row was" : "rows were"} skipped. Open the import tab to return to ${left === 1 ? "it" : "them"}.`}
        </p>
      </Banner>
    );
  }

  return (
    <Banner tone="ok" title={`Row ${rowNumber} issued`}>
      <p>
        {left} failed {left === 1 ? "row" : "rows"} left to fix. The import tab keeps the full list.
      </p>
      <div className="pt-1">
        <LinkButton
          href={fixHref(queue!.templateId, queueKey, following.rowNumber)}
          variant="primary"
          size="sm"
          icon="arrowRight"
        >
          Fix next failed row (row {following.rowNumber})
        </LinkButton>
      </div>
    </Banner>
  );
}
