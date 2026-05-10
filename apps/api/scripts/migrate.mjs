/**
 * Applies SQL migrations in lexical order from ../db/migrations/*.sql
 *
 *   DATABASE_URL=postgres://user:pass@127.0.0.1:5432/marketer npm run db:migrate -w @home-link/marketer-api
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dir = join(__dirname, "../db/migrations");

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error(
    JSON.stringify({
      level: "error",
      event: "db_migrate_missing_database_url",
      hint: "Set DATABASE_URL to a Postgres connection string.",
    }),
  );
  process.exit(1);
}

const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

if (files.length === 0) {
  console.warn(`No .sql files in ${dir}`);
  process.exit(0);
}

const sql = postgres(url, { max: 1 });

try {
  for (const file of files) {
    const fullPath = join(dir, file);
    const body = readFileSync(fullPath, "utf8");
    console.log(
      JSON.stringify({
        level: "info",
        event: "db_migrate_apply",
        file,
      }),
    );
    await sql.unsafe(body);
  }
  console.log(
    JSON.stringify({
      level: "info",
      event: "db_migrate_complete",
      filesApplied: files.length,
    }),
  );
} catch (err) {
  console.error(
    JSON.stringify({
      level: "error",
      event: "db_migrate_failed",
      message: err instanceof Error ? err.message : String(err),
    }),
  );
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
