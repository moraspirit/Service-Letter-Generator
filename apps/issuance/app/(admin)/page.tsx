import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";

export default async function DashboardPage() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-zinc-600">
        Issue a certificate from a published template, or review the templates.
      </p>
      <div className="flex gap-6">
        <Link href="/certificates/new" className="w-fit text-red-700 hover:underline">
          Issue a certificate →
        </Link>
        <Link href="/imports" className="w-fit text-red-700 hover:underline">
          Bulk import →
        </Link>
        <Link href="/templates" className="w-fit text-red-700 hover:underline">
          View templates →
        </Link>
      </div>
    </div>
  );
}
