"use client";

import { useEffect, useRef, useState } from "react";
import { Banner, Card, CardBody, CardHead, StatusPill } from "@moraspirit/ui";
import type { AnalyzedRow } from "@/lib/import/analyze-import";
import { createQueue } from "@/lib/fix-queue";
import { browserStorage, useFixQueue } from "@/lib/use-fix-queue";
import { FailedRowsTable, type FailedRowView } from "../_components/failed-rows-table";

/**
 * Rows that cannot be issued, as a table. Clicking one opens the manual issue form in a new
 * tab with that row's values prefilled and the reason it failed on the matching field. The
 * rows travel as a fix queue in this browser only (see lib/fix-queue.ts), so the tab that
 * holds this report stays exactly as it is. The queue's key rides along with the Import
 * button, so the batch page can offer the same rows afterwards.
 */
export function FailedRows({
  templateId,
  fileName,
  rows,
}: {
  templateId: number;
  fileName: string;
  rows: AnalyzedRow[];
}) {
  const [key, setKey] = useState<string | null>(null);
  const createdFor = useRef<AnalyzedRow[] | null>(null);
  const queue = useFixQueue(key, true);

  // One queue per report. `rows` is a new array for each "Check file", so a re-check starts a
  // fresh queue; the previous one is left to expire, because another tab may still be using it.
  useEffect(() => {
    if (createdFor.current === rows) return;
    const storage = browserStorage();
    if (!storage) return;
    createdFor.current = rows;
    const next = createQueue(storage, {
      templateId,
      fileName,
      rows: rows.map((r) => ({
        rowNumber: r.rowNumber,
        label: r.label,
        raw: Object.fromEntries(
          Object.entries(r.raw ?? {}).filter((e): e is [string, string] => e[1] !== undefined),
        ),
        errors: r.errors,
      })),
    });
    setKey(next);
  }, [rows, templateId, fileName]);

  if (rows.length === 0) return null;

  const state = new Map(queue?.rows.map((r) => [r.rowNumber, r]));
  const views: FailedRowView[] = rows.map((r) => ({
    rowNumber: r.rowNumber,
    label: r.label,
    errors: r.errors,
    status: state.get(r.rowNumber)?.status ?? "open",
    certificateId: state.get(r.rowNumber)?.certificateId,
  }));
  const left = views.filter((v) => v.status !== "issued").length;

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
          {key ? <input type="hidden" name="fixKey" value={key} /> : null}
          <p className="ms-help">
            Click a row to fix it by hand. It opens in a new tab with the values from your
            spreadsheet filled in and what to correct marked on each field, so this report stays
            here. After you issue one, that tab offers the next row. The same list is on the batch
            page after you import.
          </p>
          {!key ? (
            <Banner tone="warn" title="Fixing rows by hand is unavailable">
              This browser is blocking local storage, which the fix queue needs. Fix the rows in the
              spreadsheet and check the file again.
            </Banner>
          ) : null}
          <FailedRowsTable templateId={templateId} queueKey={key} rows={views} />
        </div>
      </CardBody>
    </Card>
  );
}
