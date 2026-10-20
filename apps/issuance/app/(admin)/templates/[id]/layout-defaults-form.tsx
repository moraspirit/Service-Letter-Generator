"use client";

import { useActionState, useMemo, useState } from "react";
import { renderCertificateHtml } from "@moraspirit/certificate-render";
import {
  LETTER_LAYOUT_DEFAULTS,
  letterLayoutFromRaw,
  spacingInputName,
  type CertificateData,
  type FieldSchema,
  type LetterLayout,
  type LetterLayoutKey,
} from "@moraspirit/shared";
import { Banner, Button, Card, CardBody, CardHead } from "@moraspirit/ui";
import { SpacingFields, spacingInputs } from "../../_components/spacing-fields";
import { saveLayoutDefaultsAction, type LayoutFormState } from "./actions";

const PREVIEW_SCALE = 0.48;
const initialState: LayoutFormState = { status: "idle" };

/**
 * The spacing new letters start from. Saving writes the template default only;
 * letters already issued keep the spacing stored on them.
 */
export function LayoutDefaultsForm({
  templateId,
  initial,
  htmlContent,
  fieldSchema,
  sample,
}: {
  templateId: number;
  initial: LetterLayout;
  htmlContent: string;
  fieldSchema: FieldSchema;
  sample: CertificateData;
}) {
  const [values, setValues] = useState(() => spacingInputs(initial));
  const [state, action, pending] = useActionState(saveLayoutDefaultsAction, initialState);

  const layout = useMemo(() => {
    const raw = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [
        spacingInputName(key as LetterLayoutKey),
        value,
      ]),
    );
    const parsed = letterLayoutFromRaw(raw);
    return parsed.ok && parsed.layout ? parsed.layout : initial;
  }, [initial, values]);

  const preview = useMemo(() => {
    try {
      return renderCertificateHtml(
        { html_content: htmlContent, field_schema: fieldSchema },
        sample,
        { layout },
      );
    } catch {
      return null;
    }
  }, [fieldSchema, htmlContent, layout, sample]);

  const errors = state.status === "invalid" ? state.errors : {};

  return (
    <Card>
      <CardHead title="Spacing defaults" />
      <CardBody>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="templateId" value={String(templateId)} />
          <p className="ms-help">
            New letters and spreadsheet imports start from these measurements. A letter already
            issued keeps its own spacing, and the wording of the letter stays in the template file.
          </p>
          <SpacingFields
            values={values}
            errors={errors}
            onChange={(key, value) => setValues((prev) => ({ ...prev, [key]: value }))}
          />
          {state.status === "saved" ? (
            <Banner tone="ok" title="Spacing saved">
              New letters now start from these measurements.
            </Banner>
          ) : null}
          {state.status === "missing" ? (
            <Banner tone="bad" role="alert" title="This template could not be updated">
              Reload the page and try again.
            </Banner>
          ) : null}
          {errors.form ? (
            <Banner tone="bad" role="alert" title="This could not be saved">
              {errors.form}
            </Banner>
          ) : null}
          <div className="ms-formbar">
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Saving…" : "Save spacing"}
            </Button>
            <Button
              type="submit"
              name="reset"
              value="1"
              variant="secondary"
              disabled={pending}
              onClick={() => setValues(spacingInputs(LETTER_LAYOUT_DEFAULTS))}
            >
              Restore original
            </Button>
          </div>
          {preview ? (
            <div className="ms-preview-col" aria-label="Spacing preview">
              <p className="ms-help pb-2">
                Preview with sample text. The QR code is a placeholder.
              </p>
              <div
                className="ms-preview-frame"
                style={{ width: `${8.5 * PREVIEW_SCALE}in`, height: `${11 * PREVIEW_SCALE}in` }}
              >
                <iframe
                  title="Spacing preview"
                  sandbox=""
                  srcDoc={preview}
                  style={{
                    width: "8.5in",
                    height: "11in",
                    transform: `scale(${PREVIEW_SCALE})`,
                  }}
                />
              </div>
            </div>
          ) : null}
        </form>
      </CardBody>
    </Card>
  );
}
