import Link from "next/link";
import { signOut } from "@/lib/auth";
import { requireAdmin } from "@/lib/require-admin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-6 px-4 py-3">
          <Link href="/" className="font-semibold">
            MoraSpirit Certificates
          </Link>
          <nav className="flex flex-1 gap-4 text-sm">
            <Link href="/certificates" className="text-zinc-700 hover:underline">
              Certificates
            </Link>
            <Link href="/certificates/new" className="text-zinc-700 hover:underline">
              Issue certificate
            </Link>
            <Link href="/imports" className="text-zinc-700 hover:underline">
              Bulk import
            </Link>
            <Link href="/templates" className="text-zinc-700 hover:underline">
              Templates
            </Link>
          </nav>
          <span className="text-sm text-zinc-600">{admin.email}</span>
          <form action={logout}>
            <button type="submit" className="text-sm text-red-700 hover:underline">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
