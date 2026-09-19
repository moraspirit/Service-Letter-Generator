import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { ImportForm } from "./import-form";

export const dynamic = "force-dynamic";

export default async function NewImportPage() {
  await requireAdmin();
  const templates = await prisma.template.findMany({
    where: { currentVersionId: { not: null } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="flex flex-col gap-4">
      <Link href="/imports" className="w-fit text-sm text-red-700 hover:underline">
        ← All imports
      </Link>
      <h1 className="text-2xl font-semibold">Import certificates</h1>
      <p className="max-w-2xl text-zinc-600">
        Choose the template and a spreadsheet whose columns match its fields (for the service
        letters: Member ID, Name, Gender, Pillar, Start date, End date, General Points, Special
        Points). Nothing is saved until you press Import.
      </p>
      {templates.length === 0 ? (
        <p className="text-zinc-600">
          No published templates. Run{" "}
          <code className="rounded bg-zinc-100 px-1">pnpm templates:publish</code>.
        </p>
      ) : (
        <ImportForm templates={templates} />
      )}
    </div>
  );
}
