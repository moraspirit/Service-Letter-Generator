"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * A top-bar destination that marks itself as current.
 *
 * `aria-current` drives both the announcement and the styling, so the two can
 * never disagree. `exclude` exists because "Issue" lives under /certificates:
 * without it, issuing a certificate would light up two destinations at once.
 */
export function NavLink({
  href,
  exact = false,
  exclude = [],
  children,
}: {
  href: string;
  exact?: boolean;
  exclude?: string[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const matches = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  const current = matches && !exclude.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  return (
    <Link href={href} aria-current={current ? "page" : undefined}>
      {children}
    </Link>
  );
}
