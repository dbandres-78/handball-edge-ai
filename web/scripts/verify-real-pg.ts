/**
 * Verificación contra Postgres REAL (no pg-mem) de la costura pendiente:
 *
 *   1. migrate() corre sin errores y es idempotente (dos pasadas).
 *   2. schema_version se rellena con las migraciones y applied_at es timestamptz real.
 *   3. ALTER TABLE ADD COLUMN IF NOT EXISTS funciona sobre una tabla "vieja"
 *      (simulamos un despliegue anterior sin las columnas nuevas).
 *   4. jsonb: el payload de match_event va y vuelve como objeto, con operadores jsonb.
 *   5. timestamptz: played_at conserva el instante (comparación en UTC).
 *   6. El repositorio real (matches-repo.pg) hace el ciclo completo contra Postgres:
 *      crear partido → guardar eventos (penalti, cambio de portero) → recargar →
 *      recomputar y comparar marcador.
 *
 * Uso: npm run verify:pg  (lee DATABASE_URL del entorno o de web/.env.local)
 *
 * SEGURIDAD: el script BORRA las tablas para partir de cero. Si detecta partidos ya
 * guardados, se niega a correr salvo que se pase VERIFY_RESET=1. Así nunca destruye
 * datos reales por accidente. Recomendado: usar una base de datos aparte (p. ej.
 * "handball_verify") solo para esta verificación.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { migrate } from '../lib/db/migrate';

/** Si DATABASE_URL no está en el entorno, la busca en web/.env.local (formato KEY=valor). */
function resolveDatabaseUrl(): string | undefined {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = join(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return undefined;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+)"?\s*$/);
    if (m) return m[1];
  }
  return undefined;
}

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail?: string) {
  if (ok) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
}

async function main() {
  const url = resolveDatabaseUrl();
  if (!url) throw new Error('Falta DATABASE_URL (ponla en el entorno o en web/.env.local)');
  const pool = new Pool({ connectionString: url });

  // Salvaguarda: si ya hay partidos guardados, no destruir nada sin permiso explícito.
  if (process.env.VERIFY_RESET !== '1') {
    try {
      const n = Number((await pool.query('SELECT count(*)::int AS n FROM match')).rows[0].n);
      if (n > 0) {
        console.error(`La base de datos ya contiene ${n} partido(s). Este script borra TODO para verificar desde cero.`);
        console.error('Usa una base de datos aparte (p. ej. handball_verify) o, si de verdad quieres borrar, ejecuta con VERIFY_RESET=1.');
        process.exit(2);
      }
    } catch { /* la tabla no existe: base de datos limpia, seguimos */ }
  }

  // Partimos de cero para que la verificación sea reproducible.
  await pool.query('DROP TABLE IF EXISTS match, team, player, match_event, match_read_model, schema_version CASCADE');

  // ── 3. Simular una instalación ANTIGUA: tabla match sin las columnas de las migraciones.
  await pool.query(`
    CREATE TABLE match (
      id          text PRIMARY KEY,
      competition text,
      matchday    int,
      played_at   timestamptz,
      status      text NOT NULL DEFAULT 'new'
    )
  `);
  await pool.query(`INSERT INTO match(id, competition) VALUES ('legacy-1', 'Liga vieja')`);

  // ── 1. Primera pasada de migrate().
  await migrate(pool);
  console.log('\n[1] migrate() sobre instalación antigua');

  const cols = (await pool.query(`
    SELECT column_name FROM information_schema.columns WHERE table_name = 'match'
  `)).rows.map((r) => r.column_name);
  check('ALTER añadió mode a la tabla vieja', cols.includes('mode'));
  check('ALTER añadió period_minutes', cols.includes('period_minutes'));
  check('ALTER añadió video_ref', cols.includes('video_ref'));

  const legacy = (await pool.query(`SELECT mode FROM match WHERE id = 'legacy-1'`)).rows[0];
  check("la fila antigua recibió el DEFAULT 'video' en mode", legacy?.mode === 'video');

  // ── 2. schema_version rellenada, con timestamptz real.
  console.log('\n[2] schema_version');
  const sv = (await pool.query('SELECT version, description, applied_at FROM schema_version ORDER BY version')).rows;
  check('las 2 migraciones están registradas', sv.length === 2 && sv[0].version === 1 && sv[1].version === 2);
  check('applied_at es un Date (timestamptz real)', sv.every((r) => r.applied_at instanceof Date));

  // ── 1b. Idempotencia: segunda pasada no duplica ni falla.
  await migrate(pool);
  const sv2 = (await pool.query('SELECT count(*)::int AS n FROM schema_version')).rows[0];
  check('segunda pasada de migrate() no duplica versiones', sv2.n === 2);

  // ── 4. jsonb real: ida y vuelta + operador jsonb.
  console.log('\n[3] jsonb en match_event');
  await pool.query(
    `INSERT INTO match_event(match_id, seq, game_clock_ms, period, side, player_number, type, payload)
     VALUES ('legacy-1', 0, 130000, 1, 'HOME', 7, 'SHOT', $1)`,
    [JSON.stringify({ outcome: 'GOAL', zone: 3, isPenalty: true })],
  );
  const ev = (await pool.query(`SELECT payload FROM match_event WHERE match_id = 'legacy-1'`)).rows[0];
  check('jsonb vuelve como objeto (no string)', typeof ev.payload === 'object' && ev.payload !== null);
  check('el contenido del payload se conserva', ev.payload.isPenalty === true && ev.payload.zone === 3);
  const byOp = (await pool.query(
    `SELECT count(*)::int AS n FROM match_event WHERE payload->>'outcome' = 'GOAL'`,
  )).rows[0];
  check("el operador jsonb ->> funciona", byOp.n === 1);

  // ── 5. timestamptz conserva el instante.
  console.log('\n[4] timestamptz');
  const instant = '2025-03-15T18:00:00+01:00';
  await pool.query(`UPDATE match SET played_at = $1 WHERE id = 'legacy-1'`, [instant]);
  const ts = (await pool.query(`SELECT played_at FROM match WHERE id = 'legacy-1'`)).rows[0].played_at as Date;
  check('played_at conserva el instante (UTC)', ts.toISOString() === '2025-03-15T17:00:00.000Z',
    `esperado 2025-03-15T17:00:00.000Z, obtenido ${ts?.toISOString?.()}`);

  // ── 6. Ciclo completo con el repositorio real.
  console.log('\n[5] Repositorio Postgres end-to-end');
  const { makePgMatchesRepository } = await import('../lib/db/matches-repo.pg');
  const repo = makePgMatchesRepository(pool);
  await repo.init();

  const match = await repo.create({
    competition: 'Verificación', matchday: 99, mode: 'video',
    home: { name: 'Local Real', players: [
      { number: 1, name: 'Portero A', gk: true }, { number: 12, name: 'Portero B', gk: true },
      { number: 7, name: 'Lateral', gk: false },
    ]},
    away: { name: 'Visitante Real', players: [
      { number: 16, name: 'Portero C', gk: true }, { number: 9, name: 'Pivote', gk: false },
    ]},
  });

  await repo.saveEvents(match.matchId, [
    { id: 0, t: 65, period: 1, side: 'HOME', playerNumber: 7, type: 'SHOT', outcome: 'GOAL', zone: 3, origin: null, blockerNumber: null, isPenalty: true },
    { id: 1, t: 90, period: 1, side: 'HOME', playerNumber: 12, type: 'GOALKEEPER_CHANGE', outcome: null, zone: null, origin: null, blockerNumber: null },
    { id: 2, t: 120, period: 1, side: 'AWAY', playerNumber: 9, type: 'SHOT', outcome: 'SAVED', zone: 6, origin: null, blockerNumber: null },
  ] as never);

  const reloaded = await repo.get(match.matchId);
  check('el partido se recarga desde Postgres', !!reloaded);
  check('los 3 eventos vuelven', reloaded!.events.length === 3);
  const shot = reloaded!.events.find((e: any) => e.id === 0) as any;
  check('isPenalty sobrevive al viaje por jsonb', shot?.isPenalty === true);
  const gkChange = reloaded!.events.find((e: any) => e.type === 'GOALKEEPER_CHANGE') as any;
  check('GOALKEEPER_CHANGE se reconstruye', gkChange?.playerNumber === 12);

  const list = await repo.list();
  const item = list.find((m) => m.matchId === match.matchId);
  check('el listado recomputa el marcador desde los eventos', item?.homeGoals === 1 && item?.awayGoals === 0,
    `marcador ${item?.homeGoals}-${item?.awayGoals}`);

  await pool.end();
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => { console.error(err); process.exit(1); });
