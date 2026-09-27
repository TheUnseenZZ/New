// Cross-platform first-run setup (Windows, macOS, Linux).
// Creates .env from .env.example with a random session secret, then prepares
// the database. Safe to run repeatedly.
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";

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

// The local database used to live at prisma/dev.db; keep existing data.
if (existsSync("prisma/dev.db") && !existsSync("prisma/sqlite/dev.db")) {
  renameSync("prisma/dev.db", "prisma/sqlite/dev.db");
}

// Make sure the Prisma client matches the database in .env (SQLite or Postgres).
execSync("node scripts/db.mjs generate", { stdio: "ignore" });

const usesSqlite = /DATABASE_URL\s*=\s*"?file:/.test(readFileSync(".env", "utf8"));
if (force || (usesSqlite && !existsSync("prisma/sqlite/dev.db"))) {
  console.log("• Setting up the database…");
  execSync("node scripts/db.mjs push", { stdio: "inherit" });
  console.log("✓ Database ready.");
}
