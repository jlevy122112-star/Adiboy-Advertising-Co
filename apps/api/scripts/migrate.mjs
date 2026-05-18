/**
 * Applies SQL migrations in lexical order from ../db/migrations/*.sql
 */

/* global process, console */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Load .env from repo root
try {
  const { config } = await import("dotenv");
  config({ path: new URL("../../../.env", import.meta.url).pathname });
} catch { /* dotenv optional */ }

import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dir = join(__dirname, "../db/migrations");

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error(JSON.stringify({ level: "error", event: "db_migrate_missing_database_url", hint: "Set DATABASE_URL to a Postgres connection string." }));
  process.exit(1);
}

const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
if (files.length === 0) { console.warn(`No .sql files in ${dir}`); process.exit(0); }

let applied = 0;
for (const file of files) {
  const fullPath = join(dir, file);
  const body = readFileSync(fullPath, "utf8");
  console.log(JSON.stringify({ level: "info", event: "db_migrate_apply", file }));

  // Fresh connection per file — avoids timeout on slow/serverless databases
  const sql = postgres(url, { max: 1, connect_timeout: 120, idle_timeout: 120 });
  try {
    await sql.unsafe(body);
    applied++;
  } catch (err) {
    console.error(JSON.stringify({ level: "error", event: "db_migrate_failed", file, message: err instanceof Error ? err.message : String(err) }));
    await sql.end({ timeout: 5 });
    process.exit(1);
  }
  await sql.end({ timeout: 5 });
}

console.log(JSON.stringify({ level: "info", event: "db_migrate_complete", filesApplied: applied }));
