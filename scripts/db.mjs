// Runs Prisma against the right schema for the current DATABASE_URL:
//   postgres://…  → prisma/schema.prisma          (production, e.g. Vercel + Neon)
//   file:…        → prisma/sqlite/schema.prisma   (local development)
//
// Usage: node scripts/db.mjs <generate|push|studio|build>
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

function fromDotenv(key) {
  if (!existsSync(".env")) return undefined;
  const line = readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .find((l) => l.trim().startsWith(`${key}=`));
  return line?.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
}

const url = process.env.DATABASE_URL ?? fromDotenv("DATABASE_URL") ?? "";
const postgres = /^postgres(ql)?:\/\//.test(url);
const schema = postgres ? "prisma/schema.prisma" : "prisma/sqlite/schema.prisma";

function prisma(args, env = {}) {
  execSync(`npx prisma ${args} --schema ${schema}`, { stdio: "inherit", env: { ...process.env, ...env } });
}

// Schema changes are safer over a direct (non-pooled) connection when one is available.
const direct = process.env.DATABASE_URL_UNPOOLED ?? fromDotenv("DATABASE_URL_UNPOOLED");
const pushEnv = postgres && direct ? { DATABASE_URL: direct } : {};

switch (process.argv[2]) {
  case "generate":
    prisma("generate");
    break;
  case "push":
    prisma("db push --skip-generate", pushEnv);
    break;
  case "studio":
    prisma("studio");
    break;
  case "build":
    prisma("generate");
    if (postgres) {
      // Create/update tables so a fresh database works on the first deploy.
      prisma("db push --skip-generate", pushEnv);
    } else if (process.env.VERCEL) {
      console.warn(
        "\n⚠  DATABASE_URL is not a Postgres URL. The site will deploy, but it needs a database:\n" +
          "   Vercel → your project → Storage → Create Database → Neon, then Redeploy.\n",
      );
    }
    break;
  default:
    console.error("Usage: node scripts/db.mjs <generate|push|studio|build>");
    process.exit(1);
}
