import Link from "next/link";
import { Icon } from "@moraspirit/ui";

export interface Crumb {
  label: string;
  href?: string;
}

/**
 * The action bar every admin screen opens with: where you are, what the screen
 * is for, and the one or two things you can do with it.
 *
 * The subtitle is not decoration — this tool is used a handful of times a year,
 * so each screen says what it does rather than assuming it is remembered.
 */
export function PageHeader({
  title,
  subtitle,
  crumbs,
  actions,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  crumbs?: Crumb[];
  actions?: React.ReactNode;
}) {
  return (
    <header>
      {crumbs && crumbs.length > 0 ? (
        <nav className="ms-breadcrumb" aria-label="Breadcrumb">
          {crumbs.map((crumb, i) => (
            <span key={`${crumb.label}-${i}`} className="flex items-center gap-1.5">
              {i > 0 ? <Icon name="arrowRight" size={12} /> : null}
              {crumb.href ? (
                <Link href={crumb.href}>{crumb.label}</Link>
              ) : (
                <span>{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      ) : null}
      <div className="ms-pagehead">
        <div className="min-w-0">
          <h1>{title}</h1>
          {subtitle ? <p className="ms-pagehead-sub">{subtitle}</p> : null}
        </div>
        {actions ? <div className="ms-actions">{actions}</div> : null}
      </div>
    </header>
  );
}
