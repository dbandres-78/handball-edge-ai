import type { Queryable } from './pg';
import { SCHEMA_SQL } from './schema';

/** Aplica el esquema (CREATE TABLE IF NOT EXISTS). Idempotente. */
export async function migrate(db: Queryable): Promise<void> {
  const statements = SCHEMA_SQL.split(';').map((s) => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    await db.query(stmt);
  }
}
