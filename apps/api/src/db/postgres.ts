/**
 * Lazy Postgres pool — only connects when `DATABASE_URL` is set.
 */

import postgres from "postgres";

type Sql = ReturnType<typeof postgres>;

let _sql: Sql | null | undefined;

export function getPostgresClient(): Sql | null {
  if (_sql === undefined) {
    const url = process.env.DATABASE_URL?.trim();
    _sql = url ? postgres(url, { max: 10, idle_timeout: 30 }) : null;
  }
  return _sql;
}

export async function closePostgres(): Promise<void> {
  if (_sql) {
    await _sql.end({ timeout: 10 });
  }
  _sql = undefined;
}
