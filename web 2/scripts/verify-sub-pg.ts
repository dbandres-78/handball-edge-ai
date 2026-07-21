/**
 * Verificación contra Postgres REAL de que la captura de en-pista PERSISTE:
 *  - starter (alineación) sobrevive create + saveRoster + get.
 *  - subOutNumber (cambios) sobrevive saveEvents + get (vía payload jsonb).
 *  - el ± recomputado tras recargar sigue siendo FINO (idéntico al de antes de guardar).
 *
 * Es el punto crítico de "que el ± quede fino antes de recoger datos": si no persistiera,
 * cada recarga perdería la alineación y el ± dejaría de ser individual.
 *
 * Uso: DATABASE_URL=postgresql://... npx tsx scripts/verify-sub-pg.ts
 */
import { Pool } from 'pg';
import { makePgMatchesRepository } from '../lib/db/matches-repo.pg';
import { liveStats } from '../lib/handball/mapping';
import type { UiTeam, UiEvent } from '../lib/handball/mapping';
import { EventType, ShotOutcome } from '../lib/handball/mapping';

let passed = 0, failed = 0;
const check = (name: string, ok: boolean, detail?: string) =>
  ok ? (passed++, console.log(`  ✓ ${name}`)) : (failed++, console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`));

const home: UiTeam = { name: 'Local', players: [
  { number: 1, name: 'Portero H', gk: true, starter: true },
  { number: 7, name: 'Fijo H', starter: true },
  { number: 9, name: 'Sale H', starter: true },
  { number: 4, name: 'Cuarto H', starter: true },
  { number: 15, name: 'Entra H', starter: false },
]};
const away: UiTeam = { name: 'Visitante', players: [
  { number: 12, name: 'Portero A', gk: true, starter: true },
  { number: 5, name: 'Fijo A', starter: true },
  { number: 8, name: 'Otro A', starter: true },
  { number: 3, name: 'Tercero A', starter: true },
  { number: 20, name: 'Suplente A', starter: false },
]};
let seq = 0;
const goal = (side: 'HOME' | 'AWAY', n: number, t: number): UiEvent =>
  ({ id: seq++, t, period: 1, side, playerNumber: n, type: EventType.SHOT, outcome: ShotOutcome.GOAL, zone: null });
const sub = (side: 'HOME' | 'AWAY', out: number, inn: number, t: number): UiEvent =>
  ({ id: seq++, t, period: 1, side, playerNumber: inn, type: EventType.SUBSTITUTION, outcome: null, zone: null, subOutNumber: out });
const events: UiEvent[] = [goal('HOME', 9, 10), sub('HOME', 9, 15, 20), goal('AWAY', 5, 30), goal('HOME', 7, 40)];

const findPm = (players: any[], side: string, number: number) =>
  players.find((p) => p.side === side && p.number === number)?.plusMinus;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Falta DATABASE_URL');
  const pool = new Pool({ connectionString: url });
  await pool.query('DROP TABLE IF EXISTS match, team, player, match_event, match_read_model, schema_version CASCADE');

  const repo = makePgMatchesRepository(pool);
  await repo.init();

  // ± esperado (fino), calculado en memoria antes de tocar la BD.
  const before = liveStats({ matchId: 'x' }, events, home, away).players;
  const expect = {
    h7: findPm(before, 'HOME', 7), h9: findPm(before, 'HOME', 9),
    h15: findPm(before, 'HOME', 15), a5: findPm(before, 'AWAY', 5),
  };

  // Crear (con alineación) → guardar plantilla → guardar eventos con el cambio.
  const created = await repo.create({ competition: 'Sub', matchday: 1, mode: 'video', home, away });
  await repo.saveRoster(created.matchId, home, away);
  await repo.saveEvents(created.matchId, events);

  // Recargar desde Postgres, como haría una sesión nueva.
  const reloaded = await repo.get(created.matchId);
  check('el partido se recarga', !!reloaded);

  // starter sobrevive.
  const h15 = reloaded!.home.players.find((p) => p.number === 15);
  const h7 = reloaded!.home.players.find((p) => p.number === 7);
  check('starter=false persiste (suplente sigue suplente)', h15?.starter === false, `h15.starter=${h15?.starter}`);
  check('starter=true persiste (titular sigue titular)', h7?.starter === true, `h7.starter=${h7?.starter}`);

  // subOutNumber sobrevive.
  const subEv = reloaded!.events.find((e) => e.type === EventType.SUBSTITUTION);
  check('el evento SUBSTITUTION se recarga', !!subEv);
  check('subOutNumber persiste (sale #9)', subEv?.subOutNumber === 9, `subOut=${subEv?.subOutNumber}`);
  check('playerNumber persiste (entra #15)', subEv?.playerNumber === 15, `in=${subEv?.playerNumber}`);

  // El ± recomputado tras recargar es idéntico al fino de antes de guardar.
  const after = liveStats({ matchId: reloaded!.matchId }, reloaded!.events, reloaded!.home, reloaded!.away).players;
  check('± fino sobrevive: H:7 = +1', findPm(after, 'HOME', 7) === expect.h7 && expect.h7 === 1);
  check('± fino sobrevive: H:9 (sale) = +1', findPm(after, 'HOME', 9) === expect.h9 && expect.h9 === 1);
  check('± fino sobrevive: H:15 (entra) = 0', findPm(after, 'HOME', 15) === expect.h15 && expect.h15 === 0);
  check('± fino sobrevive: A:5 = −1', findPm(after, 'AWAY', 5) === expect.a5 && expect.a5 === -1);

  await pool.end();
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
