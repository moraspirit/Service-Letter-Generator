// Prisma 7 configuration. The connection string no longer lives in
// schema.prisma — the CLI reads it from here, and the runtime client receives
// a driver adapter instead.
//
// DATABASE_URL comes from packages/db/.env (git-ignored). Use the app_rw
// credentials: this config drives migrations, which only the issuance side
// ever runs (architecture §3).
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// .env.local first (the real, git-ignored file), then .env as a fallback.
// dotenv does not overwrite variables that are already set, so the first file
// loaded wins — and a value exported in the shell still beats both.
loadEnv({ path: ".env.local" });
loadEnv();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Run by `prisma migrate reset`, so a rebuilt database is never left empty.
    seed: "node prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
