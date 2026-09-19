"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { renderCertificateHtml } from "@moraspirit/certificate-render";
import { dataFromRawValues, type FieldDefinition, type FieldSchema } from "@moraspirit/shared";
import { stateMessage, type FormState } from "./form-state";

const PREVIEW_SCALE = 0.6;
const initial: FormState = { status: "idle" };
const inputClass =
  "rounded border border-zinc-300 bg-white px-3 py-2 text-base font-normal text-zinc-900";

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
  const common = { id, name: field.name, value, required: field.required, className: inputClass };
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {field.label}
        {field.required ? null : <span className="font-normal text-zinc-500"> (optional)</span>}
      </label>
      {field.type === "select" ? (
        <select {...common} onChange={(e) => onChange(e.target.value)}>
          <option value="">Choose…</option>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : field.type === "list" || field.type === "richtext" ? (
        <>
          <textarea
            {...common}
            rows={field.type === "list" ? 6 : 4}
            onChange={(e) => onChange(e.target.value)}
          />
          <p className="text-xs text-zinc-500">
            {field.type === "list"
              ? "One item per line. A leading bullet is removed."
              : "Plain text. A blank line starts a new paragraph."}
          </p>
        </>
      ) : (
        <input
          {...common}
          type={field.type === "date" ? "date" : "text"}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The form generated from a template version's field schema. Used to issue a new
 * certificate and to edit an existing one (which additionally requires a reason).
 */
export function CertificateForm({
  mode,
  action,
  hidden,
  htmlContent,
  fieldSchema,
  defaults,
}: {
  mode: "issue" | "edit";
  action: (previous: FormState, formData: FormData) => Promise<FormState>;
  /** Extra hidden inputs the action needs (template id, or certificate id + loaded timestamp). */
  hidden: Record<string, string>;
  htmlContent: string;
  fieldSchema: FieldSchema;
  defaults: Record<string, string>;
}) {
  const [values, setValues] = useState<Record<string, string>>(defaults);
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

  const errors = state.status === "invalid" ? state.errors : {};
  const message = stateMessage(state);
  const anyway = mode === "issue" ? "Issue anyway" : "Save anyway";

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,26rem)_1fr]">
      <form action={formAction} className="flex flex-col gap-4">
        {Object.entries(hidden).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        {fieldSchema.map((field) => (
          <Field
            key={field.name}
            field={field}
            value={values[field.name] ?? ""}
            error={errors[field.name]}
            onChange={(v) => setValues((prev) => ({ ...prev, [field.name]: v }))}
          />
        ))}

        {mode === "edit" ? (
          <div className="flex flex-col gap-1 border-t border-zinc-200 pt-4">
            <label htmlFor="reason" className="text-sm font-medium">
              Reason for this change
            </label>
            <textarea
              id="reason"
              name="reason"
              rows={2}
              maxLength={500}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={inputClass}
            />
            <p className="text-xs text-zinc-500">Recorded in the audit history.</p>
            {errors.reason ? (
              <p role="alert" className="text-sm text-red-700">
                {errors.reason}
              </p>
            ) : null}
          </div>
        ) : null}

        {message ? (
          <p
            role="alert"
            className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800"
          >
            {message}
          </p>
        ) : null}

        {state.status === "duplicate" ? (
          <div
            role="alert"
            className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
          >
            <p className="font-medium">A certificate with the same key already exists.</p>
            <ul className="mt-1 list-disc pl-5">
              {state.existing.map((e) => (
                <li key={e.id}>
                  <Link href={`/certificates/${e.id}`} className="underline" target="_blank">
                    {e.id.slice(0, 8)}…
                  </Link>{" "}
                  ({e.state}, issued {e.issuedAt.slice(0, 10)})
                </li>
              ))}
            </ul>
            <button
              type="submit"
              name="confirmDuplicate"
              value="1"
              disabled={pending}
              className="mt-3 rounded bg-amber-700 px-3 py-1.5 font-medium text-white disabled:opacity-60"
            >
              {anyway}
            </button>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="w-fit rounded bg-red-700 px-4 py-2 font-medium text-white disabled:opacity-60"
        >
          {pending
            ? mode === "issue"
              ? "Issuing…"
              : "Saving…"
            : mode === "issue"
              ? "Issue certificate"
              : "Save changes"}
        </button>
      </form>

      <div>
        <p className="mb-2 text-sm text-zinc-600">Live preview (the QR code is a placeholder)</p>
        {preview ? (
          <div
            className="overflow-hidden rounded border border-zinc-300 bg-zinc-100"
            style={{ width: `${8.5 * PREVIEW_SCALE}in`, height: `${11 * PREVIEW_SCALE}in` }}
          >
            <iframe
              title="Certificate preview"
              sandbox=""
              srcDoc={preview}
              style={{
                width: "8.5in",
                height: "11in",
                border: 0,
                transform: `scale(${PREVIEW_SCALE})`,
                transformOrigin: "top left",
                background: "#fff",
              }}
            />
          </div>
        ) : (
          <p className="text-sm text-zinc-600">Fill in the form to see a preview.</p>
        )}
      </div>
    </div>
  );
}
