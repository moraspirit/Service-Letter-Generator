// Prisma 7 configuration. The connection string no longer lives in
// schema.prisma — the CLI reads it from here, and the runtime client receives
// a driver adapter instead.
//
// DATABASE_URL comes from packages/db/.env (git-ignored). Use the app_rw
// credentials: this config drives migrations, which only the issuance side
// ever runs (architecture §3).
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
