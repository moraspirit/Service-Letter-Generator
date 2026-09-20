/**
 * The system's whole icon set. Inline SVG rather than an icon font or a
 * dependency: both apps render these on the server, and the verify app must not
 * make a request for something as small as a tick.
 *
 * Every icon is drawn on a 24x24 grid with a 2px stroke so they sit together at
 * any size. They are decorative by default — each place that uses one to carry
 * meaning also writes the word.
 */

export type IconName =
  | "check"
  | "revoked"
  | "unknown"
  | "alert"
  | "info"
  | "download"
  | "search"
  | "plus"
  | "upload"
  | "file"
  | "arrowLeft"
  | "arrowRight"
  | "external"
  | "clock"
  | "edit"
  | "eye"
  | "eyeOff";

const PATHS: Record<IconName, React.ReactNode> = {
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 4.5-5" />
    </>
  ),
  revoked: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </>
  ),
  unknown: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.2 2.4c-.5.2-.7.6-.7 1.1v.5" />
      <path d="M12 16.5v.01" />
    </>
  ),
  alert: (
    <>
      <path d="M10.3 4.3 2.8 17.2A2 2 0 0 0 4.5 20h15a2 2 0 0 0 1.7-2.8L13.7 4.3a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9.5v4M12 17v.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8v.01" />
    </>
  ),
  download: (
    <>
      <path d="M12 3.5v11" />
      <path d="m7.5 10 4.5 4.5 4.5-4.5" />
      <path d="M4.5 16.5v2a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </>
  ),
  plus: <path d="M12 5.5v13M5.5 12h13" />,
  upload: (
    <>
      <path d="M12 15V4" />
      <path d="m7.5 8.5 4.5-4.5 4.5 4.5" />
      <path d="M4.5 16.5v2a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2" />
    </>
  ),
  file: (
    <>
      <path d="M14 3.5H7a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8Z" />
      <path d="M14 3.5V8h4.5" />
    </>
  ),
  arrowLeft: (
    <>
      <path d="M19 12H5" />
      <path d="m10.5 6.5-5.5 5.5 5.5 5.5" />
    </>
  ),
  arrowRight: (
    <>
      <path d="M5 12h14" />
      <path d="m13.5 6.5 5.5 5.5-5.5 5.5" />
    </>
  ),
  external: (
    <>
      <path d="M14 4.5h5.5V10" />
      <path d="M19.5 4.5 11 13" />
      <path d="M18 14.5v4a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6h4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.2l3 1.8" />
    </>
  ),
  edit: (
    <>
      <path d="M16.5 4.5a2.1 2.1 0 0 1 3 3L9 18l-4 1 1-4Z" />
      <path d="m14.5 6.5 3 3" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M10 5.7A7.8 7.8 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.8" />
      <path d="M6.5 7.6A16.8 16.8 0 0 0 2.5 12S6 18.5 12 18.5a8.9 8.9 0 0 0 3.7-.8" />
      <path d="m4 4 16 16" />
      <path d="M9.9 10a3 3 0 0 0 4.1 4.2" />
    </>
  ),
};

export interface IconProps {
  name: IconName;
  /** Pixel size; matches the surrounding text by default. */
  size?: number;
  className?: string;
  /** Give the icon an accessible name when it is not paired with visible text. */
  title?: string;
}

export function Icon({ name, size = 16, className, title }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {PATHS[name]}
    </svg>
  );
}
