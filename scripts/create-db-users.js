#!/usr/bin/env node
/**
 * Provision the two scoped database users (architecture §3).
 *
 *   app_rw     the issuance app: full read/write on the application database,
 *              plus the DDL rights needed to apply migrations.
 *   verify_ro  the public verification app: SELECT on templates,
 *              template_versions and certificates — and nothing else, so leaked
 *              Vercel credentials cannot write, cannot drop, and cannot read
 *              admin_users, certificate_audit, import_batches or login_attempts.
 *
 * Deliberately NOT a Prisma migration:
 *   - migration files are committed, and these statements contain passwords;
 *   - migrations are applied by app_rw, which has no CREATE USER privilege;
 *   - grants are environment-specific, while the schema is identical everywhere.
 *
 * Run once per environment (dev, then production in Phase 8). Idempotent: it is
 * safe to re-run, and re-running rotates both passwords.
 *
 * Usage, from the repository root:
 *
 *   node scripts/create-db-users.js                     # writes to .env.local files
 *   node scripts/create-db-users.js --print             # prints passwords instead
 *   node scripts/create-db-users.js --verify-only       # checks privileges, changes nothing
 *
 * Requires an admin connection (Aiven's avnadmin, or equivalent) in
 * ADMIN_DATABASE_URL, or in packages/db/.env.local as DATABASE_URL. The CA
 * certificate path defaults to .cert/ca.pem and can be overridden with
 * DB_CA_CERT_PATH.
 */

const fs = require("node:fs");
const path = require("node:path");
const { randomBytes } = require("node:crypto");

const ROOT = path.resolve(__dirname, "..");
const DB_PKG = path.join(ROOT, "packages", "db");

// The driver and dotenv live in packages/db, not at the repo root.
const req = (name) => require(require.resolve(name, { paths: [DB_PKG] }));
const mariadb = req("mariadb");
const dotenv = req("dotenv");

const READ_ONLY_TABLES = ["templates", "template_versions", "certificates"];
const FORBIDDEN_TO_VERIFY = [
  "admin_users",
  "certificate_audit",
  "import_batches",
  "login_attempts",
];

const args = process.argv.slice(2);
const PRINT = args.includes("--print");
const VERIFY_ONLY = args.includes("--verify-only");

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

function adminUrl() {
  if (process.env.ADMIN_DATABASE_URL) return new URL(process.env.ADMIN_DATABASE_URL);
  const envFile = path.join(DB_PKG, ".env.local");
  if (!fs.existsSync(envFile)) {
    fail("Set ADMIN_DATABASE_URL, or create packages/db/.env.local with an admin DATABASE_URL.");
  }
  const parsed = dotenv.parse(fs.readFileSync(envFile));
  if (!parsed.DATABASE_URL) fail("No DATABASE_URL found in packages/db/.env.local.");
  return new URL(parsed.DATABASE_URL);
}

function caCertificate() {
  const p = process.env.DB_CA_CERT_PATH
    ? path.resolve(ROOT, process.env.DB_CA_CERT_PATH)
    : path.join(ROOT, ".cert", "ca.pem");
  if (!fs.existsSync(p)) {
    fail(`CA certificate not found at ${p}. Set DB_CA_CERT_PATH if it lives elsewhere.`);
  }
  return fs.readFileSync(p, "utf8");
}

const connect = (url, ca) =>
  mariadb.createConnection({
    host: url.hostname,
    port: Number(url.port),
    user: url.username,
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    ssl: { ca },
  });

// base64url: no characters that would need percent-encoding in a connection URL.
const newPassword = () => randomBytes(24).toString("base64url");

/** Replace the user and password in an env file's DATABASE_URL, in place. */
function writeCredentials(relativeFile, user, password) {
  const file = path.join(ROOT, relativeFile);
  if (!fs.existsSync(file)) {
    console.log(`  ! ${relativeFile} not found — set the ${user} password there manually`);
    return;
  }
  const before = fs.readFileSync(file, "utf8");
  const after = before.replace(/mysql:\/\/[^:]+:[^@]*@/, `mysql://${user}:${password}@`);
  if (after === before) {
    console.log(`  ! no DATABASE_URL replaced in ${relativeFile} — set ${user} manually`);
    return;
  }
  fs.writeFileSync(file, after);
  console.log(`  ✓ ${relativeFile} updated (password written, not shown)`);
}

async function provision(conn, database) {
  const passwords = { app_rw: newPassword(), verify_ro: newPassword() };
  const q = (sql) => conn.query(sql);

  // app_rw — read/write plus the DDL needed by `prisma migrate deploy`.
  // Note: `prisma migrate dev` additionally needs CREATE DATABASE for its
  // shadow database, which managed providers do not grant. Create new
  // migrations locally as the admin user instead.
  await q(`CREATE USER IF NOT EXISTS 'app_rw'@'%' IDENTIFIED BY '${passwords.app_rw}'`);
  await q(`ALTER USER 'app_rw'@'%' IDENTIFIED BY '${passwords.app_rw}'`);
  await q(
    `GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX, REFERENCES ` +
      `ON \`${database}\`.* TO 'app_rw'@'%'`,
  );

  // verify_ro — SELECT on exactly three tables.
  await q(`CREATE USER IF NOT EXISTS 'verify_ro'@'%' IDENTIFIED BY '${passwords.verify_ro}'`);
  await q(`ALTER USER 'verify_ro'@'%' IDENTIFIED BY '${passwords.verify_ro}'`);
  for (const table of READ_ONLY_TABLES) {
    await q(`GRANT SELECT ON \`${database}\`.\`${table}\` TO 'verify_ro'@'%'`);
  }
  await q("FLUSH PRIVILEGES");

  for (const user of ["app_rw", "verify_ro"]) {
    const grants = await q(`SHOW GRANTS FOR '${user}'@'%'`);
    console.log(`\nGRANTS for ${user}:`);
    for (const row of grants) console.log("  " + Object.values(row)[0]);
  }

  console.log("");
  if (PRINT) {
    console.log("Passwords (store them now — they are not recoverable later):");
    for (const [user, password] of Object.entries(passwords)) {
      console.log(`  ${user}: ${password}`);
    }
  } else {
    writeCredentials("apps/issuance/.env.local", "app_rw", passwords.app_rw);
    writeCredentials("apps/verify/.env.local", "verify_ro", passwords.verify_ro);
    console.log("\n  Use --print if this environment's credentials live somewhere else");
    console.log("  (Vercel or VPS environment variables, for example).");
  }
}

/** Confirm each user can do what it should, and nothing more. */
async function verify(ca) {
  const results = [];

  const check = async (conn, label, sql, expected) => {
    let outcome;
    try {
      await conn.query(sql);
      outcome = "allowed";
    } catch (error) {
      outcome = /denied/i.test(error.message) ? "denied" : `error: ${error.message}`;
    }
    const ok = outcome === (expected === "allow" ? "allowed" : "denied");
    results.push(ok);
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}: ${outcome}`);
  };

  const credentialsFor = (relativeFile) => {
    const file = path.join(ROOT, relativeFile);
    if (!fs.existsSync(file)) return null;
    const parsed = dotenv.parse(fs.readFileSync(file));
    return parsed.DATABASE_URL ? new URL(parsed.DATABASE_URL) : null;
  };

  const rwUrl = credentialsFor("apps/issuance/.env.local");
  if (rwUrl) {
    console.log("\napp_rw:");
    const rw = await connect(rwUrl, ca);
    await check(rw, "read certificates", "SELECT COUNT(*) FROM certificates", "allow");
    await check(rw, "read admin_users", "SELECT COUNT(*) FROM admin_users", "allow");
    await rw.end();
  }

  const roUrl = credentialsFor("apps/verify/.env.local");
  if (roUrl) {
    console.log("\nverify_ro:");
    const ro = await connect(roUrl, ca);
    for (const table of READ_ONLY_TABLES) {
      await check(ro, `read ${table}`, `SELECT COUNT(*) FROM \`${table}\``, "allow");
    }
    for (const table of FORBIDDEN_TO_VERIFY) {
      await check(ro, `read ${table}`, `SELECT COUNT(*) FROM \`${table}\``, "deny");
    }
    await check(
      ro,
      "write certificates",
      "UPDATE certificates SET status = 'revoked' WHERE id = '00000000-0000-0000-0000-000000000000'",
      "deny",
    );
    await check(ro, "drop a table", "DROP TABLE login_attempts", "deny");
    await ro.end();
  }

  if (!rwUrl && !roUrl) {
    fail("No .env.local files found to verify. Run without --verify-only first.");
  }

  const failed = results.filter((ok) => !ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  if (failed) {
    fail(`${failed} privilege check(s) failed — the users are not scoped as §3 requires.`);
  }
}

async function main() {
  const url = adminUrl();
  const ca = caCertificate();
  const database = url.pathname.slice(1);

  console.log(`Database : ${database} at ${url.hostname}:${url.port}`);
  console.log(`Admin    : ${url.username}`);
  console.log(`Mode     : ${VERIFY_ONLY ? "verify only" : "provision and verify"}`);

  const conn = await connect(url, ca);
  try {
    if (!VERIFY_ONLY) await provision(conn, database);
    await verify(ca);
  } finally {
    await conn.end();
  }
}

main().catch((error) => fail(error.message));
