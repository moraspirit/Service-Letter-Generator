"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { renderCertificateHtml } from "@moraspirit/certificate-render";
import { dataFromRawValues, type FieldDefinition, type FieldSchema } from "@moraspirit/shared";
import { Banner, Button, Card, CardBody, CardHead, cx, Icon } from "@moraspirit/ui";
import { useFixQueue } from "@/lib/use-fix-queue";
import { FixQueueBanner } from "./fix-queue-banner";
import { stateMessage, type FormState } from "./form-state";

const PREVIEW_SCALE = 0.62;
const initial: FormState = { status: "idle" };

/** Long-form inputs get the full width; short ones pair up two to a row. */
function isWide(field: FieldDefinition): boolean {
  return field.type === "list" || field.type === "richtext";
}

function Field({
  field,
  value,
  error,
  onChange,
}: {
  field: FieldDefinition;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const id = `field-${field.name}`;
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const help =
    field.type === "list"
      ? "One item per line. A leading bullet is removed."
      : field.type === "richtext"
        ? "Plain text. A blank line starts a new paragraph."
        : null;

  const common = {
    id,
    name: field.name,
    value,
    required: field.required,
    "aria-invalid": error ? (true as const) : undefined,
    "aria-describedby":
      [help ? helpId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined,
  };

  return (
    <div className={cx("ms-field", isWide(field) && "ms-col-span")}>
      <label className="ms-label" htmlFor={id}>
        {field.label}
        {field.required ? (
          <span className="ms-required" aria-hidden="true">
            *
          </span>
        ) : (
          <span className="ms-label-optional">(optional)</span>
        )}
      </label>

      {field.type === "select" ? (
        <select {...common} className="ms-select" onChange={(e) => onChange(e.target.value)}>
          <option value="">Choose…</option>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : isWide(field) ? (
        <textarea
          {...common}
          className="ms-textarea"
          rows={field.type === "list" ? 6 : 4}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          {...common}
          className="ms-input"
          type={field.type === "date" ? "date" : "text"}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {help ? (
        <p className="ms-help" id={helpId}>
          {help}
        </p>
      ) : null}
      {error ? (
        <p className="ms-error" id={errorId} role="alert">
          <Icon name="alert" size={14} />
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The form generated from a template version's field schema. Used to issue a new
 * certificate and to edit an existing one (which additionally requires a reason).
 *
 * The preview is the reason this screen is not a wizard: the letter has to be
 * visible while the fields that build it are being typed.
 */
export function CertificateForm(props: FormProps & { fix?: { key: string; row: number } }) {
  const { fix, ...rest } = props;
  // Read after hydration: the queue only exists in this browser, so the first render matches
  // the server and the form remounts (via `key`) once the prefilled values are known.
  const queue = useFixQueue(fix?.key ?? null);
  const row = fix ? queue?.rows.find((r) => r.rowNumber === fix.row) : undefined;
  const usable = row && queue?.templateId === Number(rest.hidden.templateId) ? row : undefined;

  const imported = usable
    ? {
        values: Object.fromEntries(Object.entries(usable.raw).filter(([, v]) => v !== "")),
        errors: usable.errors,
      }
    : undefined;

  return (
    <>
      {fix ? (
        <div className="pb-4">
          <FixQueueBanner queueKey={fix.key} queue={queue} rowNumber={fix.row} />
        </div>
      ) : null}
      <CertificateFormBody
        key={usable ? `fix-${usable.rowNumber}` : "plain"}
        {...rest}
        hidden={fix ? { ...rest.hidden, fixKey: fix.key, fixRow: String(fix.row) } : rest.hidden}
        imported={imported}
      />
    </>
  );
}

interface FormProps {
  mode: "issue" | "edit";
  action: (previous: FormState, formData: FormData) => Promise<FormState>;
  /** Extra hidden inputs the action needs (template id, or certificate id + loaded timestamp). */
  hidden: Record<string, string>;
  htmlContent: string;
  fieldSchema: FieldSchema;
  defaults: Record<string, string>;
  cancelHref: string;
}

function CertificateFormBody({
  mode,
  action,
  hidden,
  htmlContent,
  fieldSchema,
  defaults,
  cancelHref,
  imported,
}: FormProps & {
  /** A failed import row: its typed values, and what was wrong with each field. */
  imported?: { values: Record<string, string>; errors: Record<string, string> };
}) {
  const [values, setValues] = useState<Record<string, string>>({
    ...defaults,
    ...imported?.values,
  });
  // What the import said was wrong; each message goes away once its field is edited.
  const [importedErrors, setImportedErrors] = useState<Record<string, string>>(
    imported?.errors ?? {},
  );
  const [reason, setReason] = useState("");
  const [state, formAction, pending] = useActionState(action, initial);

  // Live preview: the same render function as the PDF, running in the browser. The QR
  // code is a placeholder in the preview.
  const preview = useMemo(() => {
    try {
      return renderCertificateHtml(
        { html_content: htmlContent, field_schema: fieldSchema },
        dataFromRawValues(fieldSchema, values),
      );
    } catch {
      return null;
    }
  }, [htmlContent, fieldSchema, values]);

  const errors = { ...importedErrors, ...(state.status === "invalid" ? state.errors : {}) };
  const message = stateMessage(state);
  const anyway = mode === "issue" ? "Issue anyway" : "Save anyway";
  const submitLabel = mode === "issue" ? "Issue certificate" : "Save changes";

  return (
    <form action={formAction} className="ms-issue">
      <div className="flex flex-col gap-4">
        {Object.entries(hidden).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}

        <Card>
          <CardHead title="Certificate details" />
          <CardBody>
            <div className="ms-grid-2">
              {fieldSchema.map((field) => (
                <Field
                  key={field.name}
                  field={field}
                  value={values[field.name] ?? ""}
                  error={errors[field.name]}
                  onChange={(v) => {
                    setValues((prev) => ({ ...prev, [field.name]: v }));
                    setImportedErrors(({ [field.name]: _cleared, ...others }) => others);
                  }}
                />
              ))}
            </div>
          </CardBody>
        </Card>

        {mode === "edit" ? (
          <Card>
            <CardHead title="Why is this changing?" />
            <CardBody>
              <div className="ms-field">
                <label className="ms-label" htmlFor="reason">
                  Reason for this change
                  <span className="ms-required" aria-hidden="true">
                    *
                  </span>
                </label>
                <textarea
                  id="reason"
                  name="reason"
                  className="ms-textarea"
                  rows={2}
                  maxLength={500}
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  aria-invalid={errors.reason ? true : undefined}
                  aria-describedby="reason-help"
                />
                <p className="ms-help" id="reason-help">
                  Kept in the certificate&apos;s history alongside the old and new values. Write it
                  for whoever reads this in a year&apos;s time.
                </p>
                {errors.reason ? (
                  <p className="ms-error" role="alert">
                    <Icon name="alert" size={14} />
                    {errors.reason}
                  </p>
                ) : null}
              </div>
            </CardBody>
          </Card>
        ) : null}

        {importedErrors._render ? (
          <Banner tone="bad" role="alert" title="This row also failed to render">
            {importedErrors._render}
          </Banner>
        ) : null}

        {message ? (
          <Banner tone="bad" role="alert" title="This could not be saved">
            {message}
          </Banner>
        ) : null}

        {state.status === "duplicate" ? (
          <Banner tone="warn" role="alert" title="A certificate with the same key already exists">
            <p>
              Duplicates are allowed — this is a warning, not a block. Check the existing
              {state.existing.length === 1 ? " certificate" : " certificates"} first:
            </p>
            <ul className="ms-dup-list">
              {state.existing.map((e) => (
                <li key={e.id}>
                  <Link href={`/certificates/${e.id}`} className="ms-link" target="_blank">
                    <span className="ms-mono">{e.id.slice(0, 8)}…</span>
                  </Link>{" "}
                  — {e.state}, issued {e.issuedAt.slice(0, 10)}
                </li>
              ))}
            </ul>
            <div className="pt-1">
              <Button
                type="submit"
                name="confirmDuplicate"
                value="1"
                variant="secondary"
                size="sm"
                disabled={pending}
              >
                {anyway}
              </Button>
            </div>
          </Banner>
        ) : null}

        <div className="ms-formbar">
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? (mode === "issue" ? "Issuing…" : "Saving…") : submitLabel}
          </Button>
          <Link href={cancelHref} className="ms-btn ms-btn-ghost">
            Cancel
          </Link>
          {pending ? (
            <span className="ms-help" role="status">
              Checking the letter still fits on one page…
            </span>
          ) : null}
        </div>
      </div>

      <aside className="ms-preview-col" aria-label="Live preview">
        <div className="ms-preview-sticky">
          <div className="flex items-baseline justify-between gap-3 pb-2">
            <h2 className="ms-section-title">Live preview</h2>
            <span className="ms-help">QR code is a placeholder</span>
          </div>
          {preview ? (
            <div
              className="ms-preview-frame"
              style={{ width: `${8.5 * PREVIEW_SCALE}in`, height: `${11 * PREVIEW_SCALE}in` }}
            >
              <iframe
                title="Certificate preview"
                sandbox=""
                srcDoc={preview}
                style={{
                  width: "8.5in",
                  height: "11in",
                  transform: `scale(${PREVIEW_SCALE})`,
                }}
              />
            </div>
          ) : (
            <p className="ms-help">Fill in the form to see the letter build here.</p>
          )}
        </div>
      </aside>
    </form>
  );
}
