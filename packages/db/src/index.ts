// The only place a runtime database client is created (AGENTS.md §4).
// The issuance app connects as app_rw, the verify app as verify_ro; both go
// through this factory with their own DATABASE_URL.
import { readFileSync } from "node:fs";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";

export { PrismaClient };
export * from "../generated/prisma/client";

/**
 * Providers that sign with a private CA (Aiven) need it supplied for TLS to be
 * verified. DB_CA_CERT_B64 wins over DB_CA_CERT_PATH; with neither, the system
 * trust store is used (fine for providers with public certificates).
 */
function caCertificate(env: NodeJS.ProcessEnv): string | undefined {
  if (env.DB_CA_CERT_B64) return Buffer.from(env.DB_CA_CERT_B64, "base64").toString("utf8");
  if (env.DB_CA_CERT_PATH) return readFileSync(env.DB_CA_CERT_PATH, "utf8");
  return undefined;
}

export interface CreateClientOptions {
  /** Defaults to process.env. */
  env?: NodeJS.ProcessEnv;
  /** Pool size. The verify app must use 1 per serverless instance (architecture §3). */
  connectionLimit?: number;
}

export function createPrismaClient(options: CreateClientOptions = {}): PrismaClient {
  const env = options.env ?? process.env;
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  const url = new URL(env.DATABASE_URL);
  const ca = caCertificate(env);
  const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: Number(url.port) || 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    ...(options.connectionLimit ? { connectionLimit: options.connectionLimit } : {}),
    ...(ca ? { ssl: { ca } } : {}),
  });
  return new PrismaClient({ adapter });
}

/**
 * One client per process. In development Next reloads modules, so the instance is
 * parked on globalThis to avoid opening a new pool on every reload.
 */
const globalForDb = globalThis as unknown as { __moraspiritDb?: PrismaClient };

export function getPrisma(): PrismaClient {
  globalForDb.__moraspiritDb ??= createPrismaClient();
  return globalForDb.__moraspiritDb;
}
