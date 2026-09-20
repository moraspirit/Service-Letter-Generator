import { Icon, type IconName } from "@moraspirit/ui";

/**
 * The one thing a visitor came for, and the largest element on the page.
 *
 * The answer is carried three ways at once — colour, icon and the word itself —
 * so it survives colour blindness, a monochrome print and a glance in daylight.
 */
export function Verdict({
  tone,
  icon,
  title,
  note,
}: {
  tone: "ok" | "bad" | "unknown";
  icon: IconName;
  title: string;
  note?: string;
}) {
  return (
    <div className={`ms-verdict ms-verdict-${tone}`} role="status">
      <span className="ms-verdict-icon">
        <Icon name={icon} size={28} />
      </span>
      <div className="ms-verdict-text">
        <h1 className="ms-verdict-title">{title}</h1>
        {note ? <p className="ms-verdict-note">{note}</p> : null}
      </div>
    </div>
  );
}
