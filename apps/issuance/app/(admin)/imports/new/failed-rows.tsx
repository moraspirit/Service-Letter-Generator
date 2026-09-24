"use client";

import { useEffect, useRef, useState } from "react";
import { Banner, Card, CardBody, CardHead, Icon, StatusPill } from "@moraspirit/ui";
import type { AnalyzedRow } from "@/lib/import/analyze-import";
import { createQueue } from "@/lib/fix-queue";
import { browserStorage, useFixQueue } from "@/lib/use-fix-queue";

/**
 * Rows that cannot be issued, as a table. Clicking one opens the manual issue form in a new
 * tab with that row's values prefilled and the reason it failed on the matching field. The
 * rows travel as a fix queue in this browser only (see lib/fix-queue.ts), so the tab that
 * holds this report stays exactly as it is.
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

  const status = new Map(queue?.rows.map((r) => [r.rowNumber, r]));
  const left = rows.filter((r) => (status.get(r.rowNumber)?.status ?? "open") !== "issued").length;

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
            Click a row to fix it by hand. It opens in a new tab with the values from your
            spreadsheet filled in and what to correct marked on each field, so this report stays
            here. After you issue one, that tab offers the next row.
          </p>
          {!key ? (
            <Banner tone="warn" title="Fixing rows by hand is unavailable">
              This browser is blocking local storage, which the fix queue needs. Fix the rows in the
              spreadsheet and check the file again.
            </Banner>
          ) : null}
          <div className="ms-table-wrap">
            <table className="ms-table ms-table-top ms-table-hover">
              <caption className="sr-only">Rows that failed the check</caption>
              <thead>
                <tr>
                  <th scope="col">Row</th>
                  <th scope="col">Recipient</th>
                  <th scope="col">What to fix</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const state = status.get(row.rowNumber);
                  const issued = state?.status === "issued";
                  const href = key
                    ? `/certificates/new?template=${templateId}&fix=${key}&row=${row.rowNumber}`
                    : null;
                  return (
                    <tr key={row.rowNumber}>
                      <td className="ms-mono ms-tnum">
                        {href && !issued ? (
                          <a href={href} target="_blank" rel="noopener" className="ms-cell-link">
                            {row.rowNumber}
                            <span className="sr-only"> — open to fix</span>
                          </a>
                        ) : (
                          <span className="ms-cell-dim">{row.rowNumber}</span>
                        )}
                      </td>
                      <td className="ms-cell-name">{row.label || "—"}</td>
                      <td>
                        <ul className="ms-row-problems">
                          {Object.values(row.errors).map((p) => (
                            <li key={p}>
                              <Icon name="revoked" size={13} />
                              {p}
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td>
                        {issued ? (
                          <StatusPill tone="ok" icon="check">
                            Issued manually
                          </StatusPill>
                        ) : state?.status === "skipped" ? (
                          <StatusPill tone="warn" icon="alert">
                            Skipped
                          </StatusPill>
                        ) : (
                          <StatusPill tone="bad" icon="revoked">
                            Needs fixing
                          </StatusPill>
                        )}
                        {issued && state?.certificateId ? (
                          <a
                            href={`/certificates/${state.certificateId}`}
                            target="_blank"
                            rel="noopener"
                            className="ms-link ms-fix-open"
                          >
                            Open certificate
                          </a>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
