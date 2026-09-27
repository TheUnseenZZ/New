// Cross-platform first-run setup (Windows, macOS, Linux).
// Creates .env from .env.example with a random session secret, then prepares
// the database. Safe to run repeatedly.
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";

const force = process.argv.includes("--force");

if (!existsSync(".env")) {
  copyFileSync(".env.example", ".env");
  const env = readFileSync(".env", "utf8").replace(
    'SESSION_SECRET="replace-with-a-long-random-string"',
    `SESSION_SECRET="${randomBytes(32).toString("hex")}"`,
  );
  writeFileSync(".env", env);
  console.log('✓ Created .env — sign in with the password "change-me" (edit ADMIN_PASSWORD in .env to change it).');
}

// The local database used to live at prisma/dev.db; keep existing data
// (also when an empty file was already created at the new location).
const NEW_DB = "prisma/sqlite/dev.db";
if (existsSync("prisma/dev.db") && (!existsSync(NEW_DB) || statSync(NEW_DB).size === 0)) {
  renameSync("prisma/dev.db", NEW_DB);
}

// Make sure the Prisma client matches the database in .env (SQLite or Postgres).
execSync("node scripts/db.mjs generate", { stdio: "ignore" });

// Keep the local SQLite database in sync with the schema (fast and safe to
// repeat; also picks up new fields after a `git pull`). Postgres is synced
// on deploy, or with --force.
const usesSqlite = /DATABASE_URL\s*=\s*"?file:/.test(readFileSync(".env", "utf8"));
if (usesSqlite || force) {
  const fresh = !existsSync(NEW_DB);
  if (fresh) console.log("• Setting up the database…");
  execSync("node scripts/db.mjs push", { stdio: fresh || force ? "inherit" : "pipe" });
  if (fresh) console.log("✓ Database ready.");
}
