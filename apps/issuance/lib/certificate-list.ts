// The certificate list: search, filters and pagination.
//
// Search is a case-insensitive "contains" on member_id and recipient_name inside the
// JSON `data` column. Prisma's JSON filters are case-sensitive on MySQL, so this is a
// parameterized raw query that only selects ids; the rows are then loaded normally.
// It scans the column, which is fine for the hundreds of certificates this system holds.
import { Prisma, type PrismaClient } from "@moraspirit/db";

export const PAGE_SIZE = 25;

export interface ListQuery {
  q?: string;
  templateId?: number;
  status?: "active" | "revoked";
  page?: number;
}

/** Escapes LIKE wildcards so user input is matched literally. */
export const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

function conditions({ q, templateId, status }: ListQuery): Prisma.Sql {
  const parts: Prisma.Sql[] = [];
  if (templateId) parts.push(Prisma.sql`v.template_id = ${templateId}`);
  if (status) parts.push(Prisma.sql`c.status = ${status}`);
  const needle = q?.trim().toLowerCase();
  if (needle) {
    const pattern = `%${escapeLike(needle)}%`;
    parts.push(
      Prisma.sql`(LOWER(JSON_UNQUOTE(JSON_EXTRACT(c.data, '$.member_id'))) LIKE ${pattern}
        OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(c.data, '$.recipient_name'))) LIKE ${pattern})`,
    );
  }
  return parts.length > 0 ? Prisma.sql`WHERE ${Prisma.join(parts, " AND ")}` : Prisma.empty;
}

export async function listCertificates(prisma: PrismaClient, query: ListQuery) {
  const page = Math.max(1, Math.floor(query.page ?? 1));
  const where = conditions(query);
  const from = Prisma.sql`FROM certificates c JOIN template_versions v ON v.id = c.template_version_id`;

  const [idRows, countRows] = await Promise.all([
    prisma.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT c.id ${from} ${where}
        ORDER BY c.issued_at DESC, c.id DESC LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`,
    ),
    prisma.$queryRaw<{ total: bigint }[]>(Prisma.sql`SELECT COUNT(*) AS total ${from} ${where}`),
  ]);

  const ids = idRows.map((r) => r.id);
  const rows = await prisma.certificate.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      status: true,
      issuedAt: true,
      data: true,
      templateVersion: {
        select: { versionNumber: true, template: { select: { id: true, name: true } } },
      },
    },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const total = Number(countRows[0]?.total ?? 0);
  return {
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    // Keep the SQL ordering.
    items: ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : [])),
  };
}
