"use client";

import {
  LETTER_LAYOUT_FIELDS,
  spacingInputName,
  type LetterLayout,
  type LetterLayoutKey,
} from "@moraspirit/shared";
import { Icon } from "@moraspirit/ui";

export function spacingInputs(layout: LetterLayout): Record<LetterLayoutKey, string> {
  return {
    topIn: String(layout.topIn),
    bottomIn: String(layout.bottomIn),
    sideIn: String(layout.sideIn),
    lineHeight: String(layout.lineHeight),
    paragraphEm: String(layout.paragraphEm),
    bulletEm: String(layout.bulletEm),
    bulletIndentIn: String(layout.bulletIndentIn),
  };
}

/**
 * The seven spacing measurements. Values are numbers inside a fixed range; the
 * server is what actually accepts them.
 */
export function SpacingFields({
  values,
  errors,
  onChange,
}: {
  values: Record<LetterLayoutKey, string>;
  errors: Record<string, string>;
  onChange: (key: LetterLayoutKey, value: string) => void;
}) {
  return (
    <div className="ms-grid-2">
      {LETTER_LAYOUT_FIELDS.map((field) => {
        const name = spacingInputName(field.key);
        const error = errors[name];
        const unit = field.unit ? ` (${field.unit})` : "";
        return (
          <div className="ms-field" key={field.key}>
            <label className="ms-label" htmlFor={name}>
              {field.label}
              {unit}
            </label>
            <input
              id={name}
              name={name}
              className="ms-input"
              type="number"
              inputMode="decimal"
              min={field.min}
              max={field.max}
              step={field.step}
              value={values[field.key]}
              aria-invalid={error ? true : undefined}
              aria-describedby={`${name}-help`}
              onChange={(event) => onChange(field.key, event.target.value)}
            />
            <p className="ms-help" id={`${name}-help`}>
              Between {field.min} and {field.max}
              {field.unit ? ` ${field.unit}` : ""}.
            </p>
            {error ? (
              <p className="ms-error" role="alert">
                <Icon name="alert" size={14} />
                {error}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
