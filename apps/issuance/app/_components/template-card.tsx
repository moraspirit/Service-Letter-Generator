import Link from "next/link";
import { Icon } from "@moraspirit/ui";

export interface TemplateCardProps {
  href: string;
  name: string;
  /** Rendered letter HTML, or null for a template with nothing published yet. */
  preview: string | null;
  facts: { label: string; value: string }[];
  cta: string;
  ctaVariant?: "primary" | "secondary";
}

/**
 * One template as a card: the real letter as a thumbnail, its facts, one action.
 * The whole card is the link, so the button inside is a span, never a second
 * interactive element.
 */
export function TemplateCard({
  href,
  name,
  preview,
  facts,
  cta,
  ctaVariant = "primary",
}: TemplateCardProps) {
  return (
    <Link href={href} className="ms-choice">
      <div className="ms-choice-thumb" aria-hidden="true">
        {preview ? (
          // sandbox="" = no scripts, no same-origin, as in the template preview.
          <iframe
            title={`${name} preview`}
            sandbox=""
            srcDoc={preview}
            width={816}
            height={1056}
            tabIndex={-1}
          />
        ) : (
          <span className="ms-choice-thumb-empty">Not published</span>
        )}
      </div>
      <div className="ms-choice-body">
        <h2 className="ms-choice-title">{name}</h2>
        <dl className="ms-choice-facts">
          {facts.map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
        <span
          className={
            ctaVariant === "primary"
              ? "ms-btn ms-btn-primary ms-choice-cta"
              : "ms-btn ms-btn-secondary ms-choice-cta"
          }
        >
          {cta}
          <Icon name="arrowRight" size={16} />
        </span>
      </div>
    </Link>
  );
}
