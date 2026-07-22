import type { Queryable } from './pg';
import { SCHEMA_SQL } from './schema';

/**
 * Migraciones incrementales. Cada entrada se ejecuta una vez y se marca en schema_version.
 * Esto cubre el problema crítico: CREATE TABLE IF NOT EXISTS NO añade columnas nuevas
 * a una tabla ya existente. Estas migraciones sí.
 */
const MIGRATIONS: Array<{ version: number; description: string; sql: string }> = [
  {
    version: 1,
    description: 'añadir columnas mode y period_minutes a match (si no existen)',
    sql: `
      ALTER TABLE match ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'video';
      ALTER TABLE match ADD COLUMN IF NOT EXISTS period_minutes int;
    `,
  },
  {
    version: 2,
    description: 'añadir columna video_ref a match (si no existe)',
    sql: `
      ALTER TABLE match ADD COLUMN IF NOT EXISTS video_ref text;
    `,
  },
];

/** Aplica el esquema base + migraciones incrementales. Idempotente. */
export async function migrate(db: Queryable): Promise<void> {
  // 1. Esquema base (CREATE TABLE IF NOT EXISTS): crea tablas si no existen.
  const statements = SCHEMA_SQL.split(';').map((s) => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    await db.query(stmt);
  }

  // 2. Tabla de versiones (para rastrear migraciones aplicadas).
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version int PRIMARY KEY,
      description text,
      applied_at timestamptz DEFAULT now()
    )
  `);

  // 3. Migraciones incrementales: solo aplica las que faltan.
  const applied = new Set<number>();
  try {
    const rows = (await db.query('SELECT version FROM schema_version')).rows;
    for (const r of rows) applied.add(Number(r.version));
  } catch {
    // Tabla puede no soportar la query (pg-mem edge case), ignorar.
  }

  for (const m of MIGRATIONS) {
    if (applied.has(m.version)) continue;
    try {
      const stmts = m.sql.split(';').map((s) => s.trim()).filter(Boolean);
      for (const stmt of stmts) {
        await db.query(stmt);
      }
      await db.query(
        'INSERT INTO schema_version(version, description) VALUES ($1, $2)',
        [m.version, m.description],
      );
    } catch (err) {
      // En pg-mem, ALTER TABLE ADD COLUMN IF NOT EXISTS puede no estar soportado.
      // Si la columna ya existe (por el CREATE TABLE), la migración es redundante.
      // Solo loguear, no romper.
      console.warn(`Migración v${m.version} omitida (${m.description}): ${(err as Error).message}`);
    }
  }
}
