// Cross-platform first-run setup (Windows, macOS, Linux).
// Creates .env from .env.example with a random session secret, then creates
// the local SQLite database. Safe to run repeatedly.
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

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

const env = readFileSync(".env", "utf8");
const usesSqlite = /DATABASE_URL\s*=\s*"?file:/.test(env);
if (force || (usesSqlite && !existsSync("prisma/dev.db"))) {
  console.log("• Setting up the database…");
  execSync("npx prisma db push --skip-generate", { stdio: "inherit" });
  console.log("✓ Database ready.");
}
