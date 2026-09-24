"use client";

import Link from "next/link";
import { Banner } from "@moraspirit/ui";
import { neighbours, nextRow, notifyChange, remaining, setRowStatus } from "@/lib/fix-queue";
import type { FixQueue } from "@/lib/fix-queue";
import { browserStorage } from "@/lib/use-fix-queue";

export function fixHref(templateId: number, key: string, row: number): string {
  return `/certificates/new?template=${templateId}&fix=${key}&row=${row}`;
}

/** Shown above the manual issue form while it is fixing a row from a bulk import. */
export function FixQueueBanner({
  queueKey,
  queue,
  rowNumber,
}: {
  queueKey: string;
  queue: FixQueue | null;
  rowNumber: number;
}) {
  const row = queue?.rows.find((r) => r.rowNumber === rowNumber);
  if (!queue || !row) {
    return (
      <Banner tone="warn" role="alert" title="This fix list is no longer available">
        <p>
          It expires an hour after the file was checked, and it only exists in the browser that
          checked it. The form below is empty.{" "}
          <Link href="/imports/new" className="ms-link">
            Check the file again
          </Link>{" "}
          — rows you already issued will be flagged as duplicates and skipped.
        </p>
      </Banner>
    );
  }

  const { index, previous, next } = neighbours(queue, rowNumber);
  const following = nextRow(queue, rowNumber, rowNumber);

  function skip() {
    const storage = browserStorage();
    if (storage) {
      setRowStatus(storage, queueKey, rowNumber, "skipped");
      notifyChange();
    }
  }

  return (
    <Banner tone="info" title={`Fixing row ${row.rowNumber} from “${queue.fileName}”`}>
      <p>
        Failed row {index + 1} of {queue.rows.length} · {remaining(queue)} left to fix. The values
        below are what the spreadsheet had; each field marked in red says what to correct.
      </p>
      <div className="ms-actions pt-1">
        {previous ? (
          <Link
            href={fixHref(queue.templateId, queueKey, previous.rowNumber)}
            className="ms-btn ms-btn-ghost ms-btn-sm"
          >
            Previous row
          </Link>
        ) : null}
        {next ? (
          <Link
            href={fixHref(queue.templateId, queueKey, next.rowNumber)}
            className="ms-btn ms-btn-ghost ms-btn-sm"
          >
            Next row
          </Link>
        ) : null}
        <Link
          href={
            following ? fixHref(queue.templateId, queueKey, following.rowNumber) : "/certificates"
          }
          onClick={skip}
          className="ms-btn ms-btn-secondary ms-btn-sm"
        >
          {following ? "Skip this row" : "Skip and finish"}
        </Link>
      </div>
    </Banner>
  );
}
