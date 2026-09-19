// Small inline icons: no icon library and no network requests.
export function Icon({ kind }: { kind: "check" | "revoked" | "question" }) {
  const common = {
    width: 28,
    height: 28,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (kind === "check") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" />
        <path d="m7.5 12.5 3 3 6-7" />
      </svg>
    );
  }
  if (kind === "revoked") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" />
        <path d="m8 8 8 8M16 8l-8 8" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01" />
    </svg>
  );
}
