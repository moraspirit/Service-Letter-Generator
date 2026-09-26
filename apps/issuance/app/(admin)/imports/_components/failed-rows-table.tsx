"use client";

import { Icon, StatusPill } from "@moraspirit/ui";
import type { RowStatus } from "@/lib/fix-queue";

export interface FailedRowView {
  rowNumber: number;
  label: string;
  errors: Record<string, string>;
  status: RowStatus;
  certificateId?: string;
}

/**
 * The failed rows as a table. Clicking a row opens the manual issue form in a new tab with
 * that row prefilled (the fix queue, lib/fix-queue.ts). Shared by the import report and the
 * batch page so the two read the same.
 */
export function FailedRowsTable({
  templateId,
  queueKey,
  rows,
}: {
  templateId: number;
  /** Null when there is no queue to open rows from (storage blocked, or it expired). */
  queueKey: string | null;
  rows: FailedRowView[];
}) {
  return (
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
            const issued = row.status === "issued";
            const href = queueKey
              ? `/certificates/new?template=${templateId}&fix=${queueKey}&row=${row.rowNumber}`
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
                  ) : row.status === "skipped" ? (
                    <StatusPill tone="warn" icon="alert">
                      Skipped
                    </StatusPill>
                  ) : (
                    <StatusPill tone="bad" icon="revoked">
                      Needs fixing
                    </StatusPill>
                  )}
                  {issued && row.certificateId ? (
                    <a
                      href={`/certificates/${row.certificateId}`}
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
  );
}
