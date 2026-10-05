import Image from "next/image";
import Link from "next/link";
import { signOut } from "@/lib/auth";
import { requireAdmin } from "@/lib/require-admin";
import { NavLink } from "../_components/nav-link";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="flex flex-1 flex-col">
      <a className="ms-skip" href="#main">
        Skip to content
      </a>
      <header className="ms-topbar">
        <div className="ms-topbar-inner">
          <Link href="/" className="ms-wordmark">
            <Image
              src="/certificate-assets/mora-logo-v1.png"
              alt="MoraSpirit"
              width={262}
              height={260}
              className="ms-logo"
              unoptimized
              priority
            />
            <span>Certificates</span>
          </Link>
          <nav className="ms-nav" aria-label="Main">
            <NavLink href="/certificates" exclude={["/certificates/new"]}>
              Certificates
            </NavLink>
            <NavLink href="/certificates/new">Issue</NavLink>
            <NavLink href="/imports">Bulk import</NavLink>
            <NavLink href="/templates">Templates</NavLink>
          </nav>
          <div className="ms-topbar-account">
            <span className="ms-topbar-user">{admin.email}</span>
            <form action={logout}>
              <button type="submit" className="ms-btn ms-btn-ghost ms-btn-sm">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main id="main" className="ms-main">
        {children}
      </main>
    </div>
  );
}
