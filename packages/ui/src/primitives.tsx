/**
 * The primitives both apps share. Anything used by only one app lives in that
 * app instead, so the verify bundle stays as small as its single route deserves.
 *
 * None of these use hooks or browser APIs, so they render inside a server
 * component without a client boundary.
 */

import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./icon";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/* ---- Button ------------------------------------------------------------ */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "ms-btn-primary",
  secondary: "ms-btn-secondary",
  ghost: "ms-btn-ghost",
  danger: "ms-btn-danger",
};
const SIZE: Record<ButtonSize, string> = { sm: "ms-btn-sm", md: "", lg: "ms-btn-lg" };

function buttonClass(
  variant: ButtonVariant,
  size: ButtonSize,
  block: boolean,
  className?: string,
): string {
  return cx("ms-btn", VARIANT[variant], SIZE[size], block && "ms-btn-block", className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  icon?: IconName;
}

export function Button({
  variant = "secondary",
  size = "md",
  block = false,
  icon,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button className={buttonClass(variant, size, block, className)} {...rest}>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  );
}

export interface LinkButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  icon?: IconName;
  iconAfter?: IconName;
}

/** A link styled as a button — for navigation, never for an action. */
export function LinkButton({
  variant = "secondary",
  size = "md",
  block = false,
  icon,
  iconAfter,
  className,
  children,
  ...rest
}: LinkButtonProps) {
  return (
    <a className={buttonClass(variant, size, block, className)} {...rest}>
      {icon ? <Icon name={icon} /> : null}
      {children}
      {iconAfter ? <Icon name={iconAfter} /> : null}
    </a>
  );
}

/* ---- Card -------------------------------------------------------------- */

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cx("ms-card", className)}>{children}</section>;
}

export function CardHead({
  title,
  actions,
  className,
}: {
  title: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("ms-card-head", className)}>
      <h2 className="ms-card-title">{title}</h2>
      {actions}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("ms-card-body", className)}>{children}</div>;
}

/* ---- Status pill -------------------------------------------------------
   Tone is never the only signal: each pill also carries an icon and a word. */

export type Tone = "ok" | "bad" | "warn" | "info" | "neutral";

const PILL: Record<Tone, string> = {
  ok: "ms-pill-ok",
  bad: "ms-pill-bad",
  warn: "ms-pill-warn",
  info: "ms-pill-info",
  neutral: "ms-pill-neutral",
};

export function StatusPill({
  tone,
  icon,
  children,
  className,
}: {
  tone: Tone;
  icon?: IconName;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cx("ms-pill", PILL[tone], className)}>
      {icon ? <Icon name={icon} size={12} /> : null}
      {children}
    </span>
  );
}

/** The pill for a certificate's status, so the two apps never disagree on it. */
export function CertificateStatusPill({ status }: { status: "active" | "revoked" }) {
  return status === "active" ? (
    <StatusPill tone="ok" icon="check">
      Active
    </StatusPill>
  ) : (
    <StatusPill tone="bad" icon="revoked">
      Revoked
    </StatusPill>
  );
}

/* ---- Banner ------------------------------------------------------------ */

const BANNER: Record<Tone, string> = {
  ok: "ms-banner-ok",
  bad: "ms-banner-bad",
  warn: "ms-banner-warn",
  info: "ms-banner-info",
  neutral: "ms-banner-info",
};
const BANNER_ICON: Record<Tone, IconName> = {
  ok: "check",
  bad: "revoked",
  warn: "alert",
  info: "info",
  neutral: "info",
};

export function Banner({
  tone,
  title,
  role = "status",
  className,
  children,
}: {
  tone: Tone;
  title?: ReactNode;
  /** "alert" for something the user must act on, "status" for information. */
  role?: "alert" | "status";
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cx("ms-banner", BANNER[tone], className)} role={role}>
      <Icon name={BANNER_ICON[tone]} size={18} />
      <div className="ms-banner-content">
        {title ? <p className="ms-banner-title">{title}</p> : null}
        {children}
      </div>
    </div>
  );
}

/* ---- Description list -------------------------------------------------- */

export interface Fact {
  label: string;
  value: ReactNode;
}

export function DescriptionList({ items, className }: { items: Fact[]; className?: string }) {
  return (
    <dl className={cx("ms-dl", className)}>
      {items.map((item) => (
        <div key={item.label} className="ms-dl-row">
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ---- Empty state ------------------------------------------------------- */

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: IconName;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="ms-empty">
      {icon ? <Icon name={icon} size={24} className="ms-empty-icon" /> : null}
      <p className="ms-empty-title">{title}</p>
      {children ? <div className="ms-empty-body">{children}</div> : null}
      {action}
    </div>
  );
}
