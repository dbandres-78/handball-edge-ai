import assert from 'node:assert/strict';
import { newDb } from 'pg-mem';
import { makePgMatchesRepository } from '../lib/db/matches-repo.pg';
import { EventType, ShotOutcome, UiEvent, liveStats } from '../lib/handball/mapping';

/**
 * El modo directo debe producir EXACTAMENTE la misma estadística que la sala de vídeo:
 * misma capa canónica, mismo recompute, mismo Play Score. Lo único distinto es el reloj.
 */
async function main() {
  const mem = newDb();
  const { Pool } = mem.adapters.createPg();
  const pool = new Pool();
  const repo = makePgMatchesRepository(pool as any);
  await repo.init();

  let pass = 0, fail = 0;
  const check = async (name: string, fn: () => void | Promise<void>) => {
    try { await fn(); console.log(`  \u2713 ${name}`); pass++; }
    catch (err) { console.log(`  \u2717 ${name}`); console.log(`      ${(err as Error).message}`); fail++; }
  };

  const roster = [
    { number: 1, name: 'Portero', gk: true },
    { number: 4, name: 'Lateral' }, { number: 7, name: 'Central' }, { number: 9, name: 'Pivote' },
  ];

  let liveId = '';

  await check('se crea un partido en directo con su modo y minutos por parte', async () => {
    const m = await repo.create({
      competition: 'Liga ASOBAL', matchday: 26, mode: 'live', periodMinutes: 25,
      home: { name: 'BM Ejemplo', players: roster },
      away: { name: 'CB Rival', players: roster },
    });
    liveId = m.matchId;
    assert.equal(m.mode, 'live');
    assert.equal(m.periodMinutes, 25);
    assert.equal(m.status, 'new');
    assert.equal(m.events.length, 0);
    assert.ok(m.matchId.startsWith('LIVE-'), `id legible: ${m.matchId}`);
  });

  await check('el modo sobrevive al recargar desde la base de datos', async () => {
    const m = (await repo.get(liveId))!;
    assert.equal(m.mode, 'live');
    assert.equal(m.periodMinutes, 25);
    const item = (await repo.list()).find((x) => x.matchId === liveId)!;
    assert.equal(item.mode, 'live');
  });

  await check('los partidos del seed siguen siendo de vídeo', async () => {
    const items = await repo.list();
    assert.equal(items.find((x) => x.matchId === 'J24')!.mode, 'video');
    assert.equal(items.length, 4);   // 3 del seed + el creado en directo
  });

  // Eventos anotados en directo: el tiempo sale del reloj corrido, no de un vídeo.
  const eventos: UiEvent[] = [
    { id: 1, t: 65.4, period: 1, side: 'HOME', playerNumber: 4, type: EventType.SHOT, outcome: ShotOutcome.GOAL, zone: 3 },
    { id: 2, t: 130.2, period: 1, side: 'AWAY', playerNumber: 7, type: EventType.SHOT, outcome: ShotOutcome.SAVED, zone: null },
    { id: 3, t: 190.9, period: 1, side: 'HOME', playerNumber: 9, type: EventType.STEAL, outcome: null, zone: null },
    { id: 4, t: 240.1, period: 1, side: 'AWAY', playerNumber: 4, type: EventType.SHOT, outcome: ShotOutcome.BLOCKED, zone: null, blockerNumber: 9 },
    { id: 5, t: 300.0, period: 1, side: 'HOME', playerNumber: null, type: EventType.TIMEOUT, outcome: null, zone: null },
  ];

  await check('las acciones anotadas en directo persisten con su tiempo de reloj', async () => {
    await repo.saveEvents(liveId, eventos);
    const m = (await repo.get(liveId))!;
    assert.equal(m.events.length, 5);
    assert.equal(m.events[0].t, 65.4);              // se conservan las décimas
    assert.equal(m.events[3].blockerNumber, 9);
    assert.equal(m.status, 'tagging');
  });

  await check('la estadística en directo usa el mismo modelo que la sala de vídeo', async () => {
    const m = (await repo.get(liveId))!;
    const stats = liveStats(
      { matchId: m.matchId, competition: m.competition, matchday: m.matchday, playedAt: m.playedAt },
      m.events, m.home, m.away,
    );
    assert.equal(stats.summary.home.goals, 1);
    assert.equal(stats.summary.home.steals, 1);
    assert.equal(stats.summary.home.blocks, 1);
    assert.equal(stats.summary.home.saves, 1);
    assert.equal(stats.summary.home.timeouts, 1);

    const pivote = stats.players.find((p) => p.side === 'HOME' && p.number === 9)!;
    // 1 recuperación (+1.4 prior) + 1 blocaje (+1.0 prior)
    assert.equal(pivote.playScore.total, 2.4);
    assert.equal(pivote.playScore.fittedTotal, 0);
    assert.equal(pivote.playScore.priorTotal, 2.4);

    const lateral = stats.players.find((p) => p.side === 'HOME' && p.number === 4)!;
    assert.equal(lateral.playScore.total, 1.8);      // 1 gol
  });

  await check('finalizar el partido persiste los read-models y lo marca como extraído', async () => {
    await repo.markExtracted(liveId);
    const m = (await repo.get(liveId))!;
    assert.equal(m.status, 'extracted');
    assert.equal(m.mode, 'live');                    // finalizar no cambia el modo
    const rm = (await (pool as any).query('SELECT count(*) AS n FROM match_read_model WHERE match_id=$1', [liveId])).rows[0];
    assert.equal(Number(rm.n), 1);
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
