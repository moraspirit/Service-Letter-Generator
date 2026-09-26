"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Banner, Card, CardBody, CardHead, StatusPill } from "@moraspirit/ui";
import { useFixQueue } from "@/lib/use-fix-queue";
import { FailedRowsTable } from "../_components/failed-rows-table";

/**
 * On the batch page: the rows the import left out, ready to be fixed by hand. The rows come
 * from the fix queue kept in the browser that ran the import (lib/fix-queue.ts). It is not
 * stored on the server, so later, or in another browser, only the count is known.
 */
export function BatchRejectedRows({
  queueKey,
  rejectedCount,
}: {
  queueKey: string | null;
  rejectedCount: number;
}) {
  const queue = useFixQueue(queueKey, true);
  // The queue only exists in the browser, so say nothing until hydration has had a look.
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  if (!ready) return null;

  if (!queue) {
    return (
      <Banner
        tone="warn"
        title={`${rejectedCount} ${rejectedCount === 1 ? "row was" : "rows were"} left out of this import`}
      >
        <p>
          The list of what to fix is only kept for an hour, and only in the browser that ran the
          import, so it is no longer here. To finish them, correct the rows in the spreadsheet and{" "}
          <Link href="/imports/new" className="ms-link">
            import the file again
          </Link>
          . Rows already issued are flagged as duplicates and skipped, so only the corrected rows
          are added.
        </p>
      </Banner>
    );
  }

  const left = queue.rows.filter((r) => r.status !== "issued").length;

  return (
    <Card>
      <CardHead
        title="Rows to fix"
        actions={
          <StatusPill tone={left === 0 ? "ok" : "bad"} icon={left === 0 ? "check" : "revoked"}>
            {left === 0 ? "All fixed" : `${left} left to fix`}
          </StatusPill>
        }
      />
      <CardBody>
        <div className="flex flex-col gap-4">
          <p className="ms-help">
            These rows were left out of the import. Click one to fix it by hand: it opens the
            certificate form in a new tab with the values from your spreadsheet filled in and what
            to correct marked on each field. Fixed rows become ordinary certificates; they are not
            added to this batch or its ZIP.
          </p>
          <FailedRowsTable
            templateId={queue.templateId}
            queueKey={queueKey}
            rows={queue.rows.map((r) => ({
              rowNumber: r.rowNumber,
              label: r.label,
              errors: r.errors,
              status: r.status,
              certificateId: r.certificateId,
            }))}
          />
        </div>
      </CardBody>
    </Card>
  );
}
