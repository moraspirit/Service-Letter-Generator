"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { Banner, Button, Card, CardBody, CardHead, cx, Icon, StatusPill } from "@moraspirit/ui";
import type { GuideColumn } from "@moraspirit/shared";
import type { AnalyzedRow } from "@/lib/import/analyze-import";
import { importAction, type ImportState } from "./actions";
import { ColumnGuide } from "./column-guide";
import { FailedRows } from "./failed-rows";

const initial: ImportState = { status: "idle" };

function rowProblems(row: AnalyzedRow): string[] {
  return Object.values(row.errors);
}

/** The only genuine sequence in the app, so the only place with a step rail. */
function Steps({ current }: { current: 1 | 2 | 3 }) {
  const steps = ["Choose the file", "Review every row", "Import"];
  return (
    <ol className="ms-steps" aria-label="Import progress">
      {steps.map((label, i) => {
        const n = i + 1;
        const state = n === current ? "current" : n < current ? "done" : "todo";
        return (
          <li
            key={label}
            className={cx(
              "ms-step",
              state === "current" && "ms-step-current",
              state === "done" && "ms-step-done",
            )}
            aria-current={state === "current" ? "step" : undefined}
          >
            <span className="ms-step-marker">
              {state === "done" ? <Icon name="check" size={11} /> : n}
            </span>
            {label}
            {state === "done" ? <span className="sr-only"> (done)</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

export function ImportForm({
  templates,
  initialTemplateId = null,
}: {
  templates: { id: number; name: string; guide: GuideColumn[] }[];
  /** A template chosen on the way in (for example from the home page). */
  initialTemplateId?: number | null;
}) {
  const [state, dispatch] = useActionState(importAction, initial);
  const [pending, startTransition] = useTransition();
  // Changing the file, template or sheet makes the last report out of date.
  const [stale, setStale] = useState(false);
  const [skipInvalid, setSkipInvalid] = useState(false);
  const [templateId, setTemplateId] = useState<number | null>(initialTemplateId);
  const [fileName, setFileName] = useState("");
  const chosen = templates.find((t) => t.id === templateId) ?? null;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    // Dispatched inside a transition (not as the form's `action`) so React does not reset
    // the file input between "Check" and "Import".
    const data = new FormData(event.currentTarget, submitter);
    setStale(false);
    startTransition(() => dispatch(data));
  }

  const result = state.status === "analysis" && !stale ? state.result : null;
  const ready = result?.status === "ready" ? result : null;
  // Stable between renders: the fix queue is created once per report, keyed on this array.
  const errorRows = useMemo(
    () => ready?.rows.filter((r) => rowProblems(r).length > 0) ?? [],
    [ready],
  );
  const duplicateRows = ready?.rows.filter((r) => r.duplicate && rowProblems(r).length === 0) ?? [];
  const okCount = (ready?.rows.length ?? 0) - errorRows.length;
  const importable = ready ? okCount > 0 && (errorRows.length === 0 || skipInvalid) : false;
  const step: 1 | 2 | 3 = ready ? (importable ? 3 : 2) : 1;

  return (
    <form
      onSubmit={onSubmit}
      onChange={(e) => {
        // Only the inputs that feed the analysis invalidate it, not the per-row choices.
        if (
          ["templateId", "file", "sheetName"].includes(
            (e.target as unknown as HTMLInputElement).name,
          )
        ) {
          setStale(true);
        }
        if ((e.target as unknown as HTMLInputElement).name === "file") {
          setFileName((e.target as unknown as HTMLInputElement).files?.[0]?.name ?? "");
        }
      }}
      className="ms-import"
    >
      <aside className="ms-import-rail">
        <div className="ms-import-rail-inner">
          <Steps current={step} />
          <p className="ms-help">Nothing is written to the database until you press Import.</p>
        </div>
      </aside>

      <div className="flex flex-col gap-5">
        <Card>
          <CardHead title="1 · Choose the file" />
          <CardBody>
            <div className="ms-grid-2">
              <div className="ms-field">
                <label className="ms-label" htmlFor="templateId">
                  Template
                  <span className="ms-required" aria-hidden="true">
                    *
                  </span>
                </label>
                <select
                  id="templateId"
                  name="templateId"
                  required
                  className="ms-select"
                  defaultValue={initialTemplateId ?? ""}
                  onChange={(e) => setTemplateId(Number(e.target.value) || null)}
                >
                  <option value="" disabled>
                    Choose…
                  </option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="ms-field">
                <label className="ms-label" htmlFor="file">
                  Spreadsheet
                  <span className="ms-required" aria-hidden="true">
                    *
                  </span>
                </label>
                <input
                  id="file"
                  type="file"
                  name="file"
                  required
                  accept=".xlsx,.csv"
                  className="ms-file"
                  aria-describedby="file-help"
                />
                <p className="ms-help" id="file-help">
                  .xlsx, or .csv saved as UTF-8. Up to 5 MB.
                </p>
              </div>

              {result?.status === "choose_sheet" ? (
                <div className="ms-field ms-col-span">
                  <label className="ms-label" htmlFor="sheetName">
                    Which worksheet?
                    <span className="ms-required" aria-hidden="true">
                      *
                    </span>
                  </label>
                  <select
                    id="sheetName"
                    name="sheetName"
                    required
                    className="ms-select"
                    defaultValue=""
                    aria-describedby="sheet-help"
                  >
                    <option value="" disabled>
                      Choose…
                    </option>
                    {result.sheetNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <p className="ms-help" id="sheet-help">
                    This workbook has several worksheets, so the right one has to be named.
                  </p>
                </div>
              ) : ready?.sheetName ? (
                <input type="hidden" name="sheetName" value={ready.sheetName} />
              ) : null}
            </div>
            {chosen ? (
              <ColumnGuide
                templateId={chosen.id}
                templateName={chosen.name}
                columns={chosen.guide}
              />
            ) : (
              <p className="ms-help">
                Choose a template to see the columns its spreadsheet needs, and to download a blank
                one to start from.
              </p>
            )}
          </CardBody>
          <div className="ms-card-foot">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="submit"
                name="intent"
                value="check"
                variant="secondary"
                disabled={pending}
              >
                {pending ? "Working…" : "Check file"}
              </Button>
              {pending ? (
                <span className="ms-help" role="status">
                  Checking every row, including that each letter fits on one page. This can take up
                  to a minute for a large file.
                </span>
              ) : null}
            </div>
          </div>
        </Card>

        {state.status === "failed" && !stale ? (
          <Banner tone="bad" role="alert" title="The file could not be read">
            {state.message}
          </Banner>
        ) : null}
        {state.status === "blocked" && !stale ? (
          <Banner tone="warn" role="alert" title="Import blocked">
            {state.message}
          </Banner>
        ) : null}

        {result && result.status !== "ready" && result.status !== "choose_sheet" ? (
          <Banner
            tone="bad"
            role="alert"
            title={
              result.status === "column_error"
                ? "The columns do not match this template"
                : "This file cannot be imported"
            }
          >
            {result.status === "column_error" ? (
              <>
                {result.missingRequired.length > 0 ? (
                  <p>
                    <strong>Missing required columns:</strong> {result.missingRequired.join(", ")}.
                  </p>
                ) : null}
                {result.duplicated.length > 0 ? (
                  <p>
                    <strong>Columns that repeat a field:</strong> {result.duplicated.join(", ")}.
                  </p>
                ) : null}
                {result.unknown.length > 0 ? (
                  <p>Ignored columns: {result.unknown.join(", ")}.</p>
                ) : null}
              </>
            ) : (
              <p>{result.message}</p>
            )}
          </Banner>
        ) : null}

        {ready ? (
          <>
            <Card>
              <CardHead
                title="2 · Review every row"
                actions={
                  <span className="ms-counts">
                    <StatusPill tone="ok" icon="check">
                      {okCount} will be issued
                    </StatusPill>
                    {errorRows.length > 0 ? (
                      <StatusPill tone="bad" icon="revoked">
                        {errorRows.length} with errors
                      </StatusPill>
                    ) : null}
                    {duplicateRows.length > 0 ? (
                      <StatusPill tone="warn" icon="alert">
                        {duplicateRows.length} possible duplicates
                      </StatusPill>
                    ) : null}
                  </span>
                }
              />
              <CardBody>
                <div className="flex flex-col gap-4">
                  <p className="ms-help">
                    {ready.rows.length} rows · template version {ready.templateVersionNumber}
                    {ready.sheetName ? ` · sheet “${ready.sheetName}”` : ""}
                  </p>

                  {ready.unknownColumns.length > 0 ? (
                    <Banner tone="info" title="Some columns were ignored">
                      {ready.unknownColumns.join(", ")}. They do not match any field in this
                      template and will not be imported.
                    </Banner>
                  ) : null}

                  {ready.fileDuplicate ? (
                    <Banner tone="warn" title="This exact file was already imported">
                      <p>
                        Imported on {ready.fileDuplicate.importedAt.slice(0, 10)} by{" "}
                        {ready.fileDuplicate.adminEmail} ({ready.fileDuplicate.insertedCount}{" "}
                        certificates).
                      </p>
                      <label className="ms-check pt-1">
                        <input type="checkbox" name="confirmDuplicateFile" value="1" />
                        <span>Import it again anyway</span>
                      </label>
                    </Banner>
                  ) : null}

                  <div className="ms-table-wrap">
                    <table className="ms-table ms-table-top">
                      <caption className="sr-only">Row-by-row import report</caption>
                      <thead>
                        <tr>
                          <th scope="col">Row</th>
                          <th scope="col">Recipient</th>
                          <th scope="col">Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ready.rows.map((row) => {
                          const problems = rowProblems(row);
                          return (
                            <tr key={row.rowNumber}>
                              <td className="ms-mono ms-tnum ms-cell-dim">{row.rowNumber}</td>
                              <td className="ms-cell-name">{row.label || "—"}</td>
                              <td>
                                {problems.length > 0 ? (
                                  <ul className="ms-row-problems">
                                    {problems.map((p) => (
                                      <li key={p}>
                                        <Icon name="revoked" size={13} />
                                        {p}
                                      </li>
                                    ))}
                                  </ul>
                                ) : row.duplicate ? (
                                  <div className="ms-row-dup">
                                    <span>
                                      {row.duplicate.earlierRow !== null
                                        ? `Same as row ${row.duplicate.earlierRow} in this file. `
                                        : ""}
                                      {row.duplicate.existing.length > 0 ? (
                                        <>
                                          Already issued:{" "}
                                          {row.duplicate.existing.map((e, i) => (
                                            <span key={e.id}>
                                              {i > 0 ? ", " : ""}
                                              <a
                                                href={`/certificates/${e.id}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="ms-link"
                                              >
                                                {e.issuedAt.slice(0, 10)} ({e.status})
                                              </a>
                                            </span>
                                          ))}
                                        </>
                                      ) : null}
                                    </span>
                                    <label className="ms-check">
                                      <input
                                        type="checkbox"
                                        name="issueAnyway"
                                        value={row.rowNumber}
                                      />
                                      <span>Issue anyway (otherwise skipped)</span>
                                    </label>
                                  </div>
                                ) : (
                                  <StatusPill tone="ok" icon="check">
                                    Will be issued
                                  </StatusPill>
                                )}
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

            {templateId && errorRows.length > 0 ? (
              <FailedRows templateId={templateId} fileName={fileName} rows={errorRows} />
            ) : null}

            <Card>
              <CardHead title="3 · Import" />
              <CardBody>
                <div className="flex flex-col gap-4">
                  {errorRows.length > 0 ? (
                    <Banner tone="bad" title={`${errorRows.length} rows cannot be issued`}>
                      <p>
                        Fix them by hand from the list above, fix them in the spreadsheet and check
                        the file again, or leave them out of this import. Invalid rows are never
                        issued either way.
                      </p>
                      <label className="ms-check pt-1">
                        <input
                          type="checkbox"
                          name="skipInvalid"
                          value="1"
                          checked={skipInvalid}
                          onChange={(e) => setSkipInvalid(e.target.checked)}
                        />
                        <span>
                          Skip the {errorRows.length} invalid{" "}
                          {errorRows.length === 1 ? "row" : "rows"} and import the other {okCount}
                        </span>
                      </label>
                    </Banner>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="submit"
                      name="intent"
                      value="import"
                      variant="primary"
                      disabled={pending || !importable}
                    >
                      {pending
                        ? "Importing…"
                        : `Import ${okCount} ${okCount === 1 ? "certificate" : "certificates"}`}
                    </Button>
                    {!importable && errorRows.length > 0 && !skipInvalid ? (
                      <span className="ms-help">
                        Blocked while rows have errors. Tick the box above to go ahead without them.
                      </span>
                    ) : null}
                  </div>
                </div>
              </CardBody>
            </Card>
          </>
        ) : null}
      </div>
    </form>
  );
}
