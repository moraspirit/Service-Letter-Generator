// The verification app's database client: connects as verify_ro (SELECT on templates,
// template_versions and certificates only). One client per server instance, with a single
// connection, because the page is uncached and serverless instances multiply (architecture §3).
import { createPrismaClient, type PrismaClient } from "@moraspirit/db";

const globalForDb = globalThis as unknown as { __verifyDb?: PrismaClient };

/** Created on first use, so importing this module (e.g. during a build) never connects. */
export function getDb(): PrismaClient {
  return (globalForDb.__verifyDb ??= createPrismaClient({ connectionLimit: 1 }));
}
