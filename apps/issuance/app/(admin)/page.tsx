import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";

export default async function DashboardPage() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-zinc-600">
        Certificate issuance arrives in the next phases. For now you can review the published
        templates.
      </p>
      <Link href="/templates" className="w-fit text-red-700 hover:underline">
        View templates →
      </Link>
    </div>
  );
}
