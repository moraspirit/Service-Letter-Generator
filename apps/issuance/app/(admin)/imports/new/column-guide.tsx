import { LinkButton, StatusPill } from "@moraspirit/ui";
import type { GuideColumn } from "@moraspirit/shared";

/**
 * The columns a spreadsheet needs for the chosen template. Built from the template's own
 * field schema, so it cannot disagree with what the importer accepts.
 */
export function ColumnGuide({
  templateId,
  templateName,
  columns,
}: {
  templateId: number;
  templateName: string;
  columns: GuideColumn[];
}) {
  return (
    <section className="ms-guide" aria-labelledby="guide-title">
      <div className="ms-guide-head">
        <div>
          <h3 id="guide-title" className="ms-section-title">
            Columns for {templateName}
          </h3>
          <p className="ms-help">
            Put these headings in row 1, in any order. Case and spacing do not matter.
          </p>
        </div>
        <LinkButton
          href={`/imports/template/${templateId}`}
          variant="secondary"
          size="sm"
          icon="download"
        >
          Download blank spreadsheet
        </LinkButton>
      </div>

      <div className="ms-table-wrap">
        <table className="ms-table ms-table-top">
          <caption className="sr-only">Columns required for {templateName}</caption>
          <thead>
            <tr>
              <th scope="col">Column heading</th>
              <th scope="col">Needed?</th>
              <th scope="col">How to fill it in</th>
            </tr>
          </thead>
          <tbody>
            {columns.map((c) => (
              <tr key={c.heading}>
                <th scope="row" className="ms-cell-name ms-guide-heading">
                  {c.heading}
                </th>
                <td>
                  {c.required ? (
                    <StatusPill tone="bad" icon="alert">
                      Required
                    </StatusPill>
                  ) : c.autoFilled ? (
                    <StatusPill tone="info" icon="info">
                      Filled automatically
                    </StatusPill>
                  ) : (
                    <StatusPill tone="neutral">Optional</StatusPill>
                  )}
                </td>
                <td className="ms-guide-how">{c.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="ms-guide-rules">
        <li>
          <strong>A required column missing from the file</strong> stops the upload, and the message
          names it.
        </li>
        <li>
          <strong>A blank cell in a required column</strong> fails that row only. It is listed with
          the reason and is never issued. You can skip failing rows and import the rest.
        </li>
        <li>
          <strong>A blank optional cell</strong> is fine; the letter leaves that section out.
        </li>
        <li>Extra columns are ignored and listed in the report.</li>
      </ul>
    </section>
  );
}
