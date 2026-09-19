"use client";

import { useActionState, useState, useTransition } from "react";
import type { AnalyzedRow } from "@/lib/import/analyze-import";
import { importAction, type ImportState } from "./actions";

const initial: ImportState = { status: "idle" };
const inputClass = "rounded border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900";
const box = "rounded border px-3 py-2 text-sm";

function rowProblems(row: AnalyzedRow): string[] {
  return Object.values(row.errors);
}

export function ImportForm({ templates }: { templates: { id: number; name: string }[] }) {
  const [state, dispatch] = useActionState(importAction, initial);
  const [pending, startTransition] = useTransition();
  // Changing the file, template or sheet makes the last report out of date.
  const [stale, setStale] = useState(false);
  const [skipInvalid, setSkipInvalid] = useState(false);

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
  const errorRows = ready?.rows.filter((r) => rowProblems(r).length > 0) ?? [];
  const duplicateRows = ready?.rows.filter((r) => r.duplicate && rowProblems(r).length === 0) ?? [];
  const okCount = (ready?.rows.length ?? 0) - errorRows.length;
  const importable = ready ? okCount > 0 && (errorRows.length === 0 || skipInvalid) : false;

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
      }}
      className="flex flex-col gap-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Template
          <select name="templateId" required className={inputClass} defaultValue="">
            <option value="" disabled>
              Choose…
            </option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Spreadsheet (.xlsx or UTF-8 .csv)
          <input
            type="file"
            name="file"
            required
            accept=".xlsx,.csv"
            className={`${inputClass} text-sm`}
          />
        </label>
      </div>

      {result?.status === "choose_sheet" ? (
        <label className="flex flex-col gap-1 text-sm font-medium">
          This workbook has several worksheets. Which one should be imported?
          <select name="sheetName" required className={inputClass} defaultValue="">
            <option value="" disabled>
              Choose…
            </option>
            {result.sheetNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      ) : ready?.sheetName ? (
        <input type="hidden" name="sheetName" value={ready.sheetName} />
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          name="intent"
          value="check"
          disabled={pending}
          className="rounded bg-zinc-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Working…" : "Check file"}
        </button>
        {pending ? (
          <span className="text-sm text-zinc-600" role="status">
            Checking every row, including that each letter fits on one page. This can take up to a
            minute for a large file.
          </span>
        ) : null}
      </div>

      {state.status === "failed" && !stale ? (
        <p role="alert" className={`${box} border-red-300 bg-red-50 text-red-800`}>
          {state.message}
        </p>
      ) : null}
      {state.status === "blocked" && !stale ? (
        <p role="alert" className={`${box} border-amber-300 bg-amber-50 text-amber-900`}>
          {state.message}
        </p>
      ) : null}

      {result && result.status !== "ready" && result.status !== "choose_sheet" ? (
        <div role="alert" className={`${box} border-red-300 bg-red-50 text-red-800`}>
          {result.status === "column_error" ? (
            <>
              <p className="font-medium">The columns do not match this template.</p>
              {result.missingRequired.length > 0 ? (
                <p>Missing required columns: {result.missingRequired.join(", ")}.</p>
              ) : null}
              {result.duplicated.length > 0 ? (
                <p>Columns that repeat a field: {result.duplicated.join(", ")}.</p>
              ) : null}
              {result.unknown.length > 0 ? (
                <p>Ignored columns: {result.unknown.join(", ")}.</p>
              ) : null}
            </>
          ) : (
            <p>{result.message}</p>
          )}
        </div>
      ) : null}

      {ready ? (
        <section className="flex flex-col gap-4" aria-label="Import report">
          <div className="flex flex-wrap gap-4 text-sm">
            <span>{ready.rows.length} rows</span>
            <span className="text-green-800">{okCount} valid</span>
            <span className={errorRows.length ? "font-medium text-red-800" : ""}>
              {errorRows.length} with errors
            </span>
            <span>{duplicateRows.length} possible duplicates</span>
            <span className="text-zinc-500">
              Template version {ready.templateVersionNumber}
              {ready.sheetName ? ` · sheet “${ready.sheetName}”` : ""}
            </span>
          </div>

          {ready.unknownColumns.length > 0 ? (
            <p className={`${box} border-zinc-300 bg-zinc-50 text-zinc-700`}>
              Ignored columns: {ready.unknownColumns.join(", ")}.
            </p>
          ) : null}

          {ready.fileDuplicate ? (
            <label
              className={`${box} flex items-start gap-2 border-amber-300 bg-amber-50 text-amber-900`}
            >
              <input type="checkbox" name="confirmDuplicateFile" value="1" className="mt-1" />
              <span>
                This exact file was already imported on{" "}
                {ready.fileDuplicate.importedAt.slice(0, 10)} by {ready.fileDuplicate.adminEmail} (
                {ready.fileDuplicate.insertedCount} certificates). Tick to import it again.
              </span>
            </label>
          ) : null}

          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-300 text-zinc-600">
              <tr>
                <th className="py-2 pr-4">Row</th>
                <th className="py-2 pr-4">Recipient</th>
                <th className="py-2">Result</th>
              </tr>
            </thead>
            <tbody>
              {ready.rows.map((row) => {
                const problems = rowProblems(row);
                return (
                  <tr key={row.rowNumber} className="border-b border-zinc-200 align-top">
                    <td className="py-2 pr-4 font-mono text-xs">{row.rowNumber}</td>
                    <td className="py-2 pr-4">{row.label || "—"}</td>
                    <td className="py-2">
                      {problems.length > 0 ? (
                        <ul className="text-red-800">
                          {problems.map((p) => (
                            <li key={p}>{p}</li>
                          ))}
                        </ul>
                      ) : row.duplicate ? (
                        <div className="flex flex-col gap-1 text-amber-900">
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
                                      className="text-red-700 underline"
                                    >
                                      {e.issuedAt.slice(0, 10)} ({e.status})
                                    </a>
                                  </span>
                                ))}
                              </>
                            ) : null}
                          </span>
                          <label className="flex items-center gap-2">
                            <input type="checkbox" name="issueAnyway" value={row.rowNumber} />
                            Issue anyway (otherwise skipped)
                          </label>
                        </div>
                      ) : (
                        <span className="text-green-800">Will be issued</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {errorRows.length > 0 ? (
            <label
              className={`${box} flex items-start gap-2 border-red-300 bg-red-50 text-red-900`}
            >
              <input
                type="checkbox"
                name="skipInvalid"
                value="1"
                className="mt-1"
                checked={skipInvalid}
                onChange={(e) => setSkipInvalid(e.target.checked)}
              />
              <span>
                Skip the {errorRows.length} invalid {errorRows.length === 1 ? "row" : "rows"} and
                import the rest. Invalid rows are never issued.
              </span>
            </label>
          ) : null}

          <div>
            <button
              type="submit"
              name="intent"
              value="import"
              disabled={pending || !importable}
              className="rounded bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {pending ? "Importing…" : "Import valid rows"}
            </button>
            {errorRows.length > 0 && !skipInvalid ? (
              <p className="mt-2 text-sm text-zinc-600">
                Importing is blocked while rows have errors. Fix the file, or tick the box above.
              </p>
            ) : null}
          </div>
        </section>
      ) : null}
    </form>
  );
}
