import assert from 'node:assert/strict';
import { newDb } from 'pg-mem';
import { makePgMatchesRepository } from '../lib/db/matches-repo.pg';
import { EventType, ShotOrigin, ShotOutcome, UiEvent, liveStats } from '../lib/handball/mapping';

/**
 * Zonas de lanzamiento: comprueba que se captura y agrega lo que xG/xGOT necesitan.
 *  - xG   : tiros y goles POR ZONA DE ORIGEN.
 *  - xGOT : tiros a puerta (gol + parada) y su colocación en la portería.
 */
const home = { name: 'BM Ejemplo', players: [
  { number: 1, name: 'Portero', gk: true }, { number: 7, name: 'Extremo' },
  { number: 9, name: 'Pivote' }, { number: 4, name: 'Lateral' },
] };
const away = { name: 'CB Rival', players: [
  { number: 1, name: 'Portero', gk: true }, { number: 5, name: 'Lateral' },
] };

let id = 0;
const shot = (side: 'HOME' | 'AWAY', num: number, origin: ShotOrigin | null,
  outcome: ShotOutcome, zone: number | null = null): UiEvent =>
  ({ id: id++, t: id * 10, period: 1, side, playerNumber: num, type: EventType.SHOT, outcome, zone, origin });

const eventos: UiEvent[] = [
  // Extremo izquierdo: ángulo cerrado -> 1 de 3
  shot('HOME', 7, ShotOrigin.WING_LEFT, ShotOutcome.GOAL, 7),
  shot('HOME', 7, ShotOrigin.WING_LEFT, ShotOutcome.SAVED),
  shot('HOME', 7, ShotOrigin.WING_LEFT, ShotOutcome.MISSED),
  // 6 m centro (pivote): cerca y con ángulo -> 2 de 2
  shot('HOME', 9, ShotOrigin.SIX_CENTER, ShotOutcome.GOAL, 5),
  shot('HOME', 9, ShotOrigin.SIX_CENTER, ShotOutcome.GOAL, 4),
  // 9 m centro: lejos -> 0 de 2 (uno blocado)
  shot('HOME', 4, ShotOrigin.NINE_CENTER, ShotOutcome.SAVED),
  shot('HOME', 4, ShotOrigin.NINE_CENTER, ShotOutcome.BLOCKED),
  // Tiro sin zona anotada: cuenta como tiro, pero no entra en los mapas
  shot('HOME', 4, null, ShotOutcome.GOAL, 1),
  // Rival
  shot('AWAY', 5, ShotOrigin.NINE_LEFT, ShotOutcome.GOAL, 3),
];

const meta = { matchId: 'ZONAS', competition: 'Test', matchday: 1, playedAt: '2026-07-15T10:00:00.000Z' };

let pass = 0, fail = 0;
const check = async (name: string, fn: () => void | Promise<void>) => {
  try { await fn(); console.log(`  \u2713 ${name}`); pass++; }
  catch (err) { console.log(`  \u2717 ${name}`); console.log(`      ${(err as Error).message}`); fail++; }
};

async function main() {
  const { summary, players } = liveStats(meta, eventos, home, away);

  await check('el desglose por zona de origen alimenta el xG (tiros y goles)', () => {
    const o = summary.home.byOrigin;
    assert.deepEqual(o[ShotOrigin.WING_LEFT], { shots: 3, goals: 1, onTarget: 2, saved: 1, missed: 1, blocked: 0 });
    assert.deepEqual(o[ShotOrigin.SIX_CENTER], { shots: 2, goals: 2, onTarget: 2, saved: 0, missed: 0, blocked: 0 });
    assert.deepEqual(o[ShotOrigin.NINE_CENTER], { shots: 2, goals: 0, onTarget: 1, saved: 1, missed: 0, blocked: 1 });
  });

  await check('la eficacia por zona refleja la geometría del balonmano', () => {
    const o = summary.home.byOrigin;
    const conv = (z: ShotOrigin) => o[z]!.goals / o[z]!.shots;
    assert.equal(conv(ShotOrigin.SIX_CENTER), 1);            // 6 m centro: cerca y con ángulo
    assert.ok(conv(ShotOrigin.WING_LEFT) < conv(ShotOrigin.SIX_CENTER));  // extremo: ángulo cerrado
    assert.equal(conv(ShotOrigin.NINE_CENTER), 0);           // 9 m: lejos
  });

  await check('onTarget separa lo que ve el xGOT (gol o parada, no fuera ni blocado)', () => {
    const o = summary.home.byOrigin;
    assert.equal(o[ShotOrigin.WING_LEFT]!.onTarget, 2);      // gol + parada; el fallado no
    assert.equal(o[ShotOrigin.NINE_CENTER]!.onTarget, 1);    // parada; el blocado no
  });

  await check('las zonas de portería quedan agregadas para el xGOT', () => {
    assert.deepEqual(summary.home.goalZones, { 7: 1, 5: 1, 4: 1, 1: 1 });
    assert.deepEqual(summary.away.goalZones, { 3: 1 });
  });

  await check('un tiro sin zona cuenta como tiro pero no ensucia los mapas', () => {
    assert.equal(summary.home.shots, 8);
    const enMapa = Object.values(summary.home.byOrigin).reduce((a, c) => a + (c?.shots ?? 0), 0);
    assert.equal(enMapa, 7);                                  // el tiro sin origen queda fuera
  });

  await check('cada jugador tiene su propio desglose por zona', () => {
    const extremo = players.find((p) => p.side === 'HOME' && p.number === 7)!;
    assert.equal(extremo.byOrigin[ShotOrigin.WING_LEFT]!.shots, 3);
    assert.equal(extremo.byOrigin[ShotOrigin.WING_LEFT]!.goals, 1);
    const pivote = players.find((p) => p.side === 'HOME' && p.number === 9)!;
    assert.equal(pivote.byOrigin[ShotOrigin.SIX_CENTER]!.goals, 2);
    assert.equal(pivote.byOrigin[ShotOrigin.WING_LEFT], undefined);
  });

  await check('la zona de lanzamiento sobrevive al guardar y recargar', async () => {
    const mem = newDb();
    const { Pool } = mem.adapters.createPg();
    const pool = new Pool();
    const repo = makePgMatchesRepository(pool as any);
    await repo.init();
    const m = await repo.create({ mode: 'live', home, away, competition: 'Test' });
    await repo.saveEvents(m.matchId, eventos);

    const reload = (await repo.get(m.matchId))!;
    assert.equal(reload.events[0].origin, ShotOrigin.WING_LEFT);
    const stats = liveStats({ matchId: reload.matchId, playedAt: reload.playedAt }, reload.events, reload.home, reload.away);
    assert.deepEqual(stats.summary.home.byOrigin[ShotOrigin.SIX_CENTER], { shots: 2, goals: 2, onTarget: 2, saved: 0, missed: 0, blocked: 0 });
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
