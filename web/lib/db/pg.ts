import { Pool } from 'pg';

/** Contrato mínimo que cumplen tanto `pg.Pool` como el pool de `pg-mem`. */
export interface Queryable {
  query(text: string, params?: unknown[]): Promise<{ rows: any[] }>;
}

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

/** jsonb de pg-mem/pg puede llegar como objeto o como string; normaliza. */
export function asJson<T>(v: unknown): T {
  return typeof v === 'string' ? (JSON.parse(v) as T) : (v as T);
}
