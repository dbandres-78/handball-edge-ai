import assert from 'node:assert/strict';
import { newDb } from 'pg-mem';
import { makePgMatchesRepository } from '../lib/db/matches-repo.pg';
import { EventType, ShotOutcome, UiEvent, liveStats } from '../lib/handball/mapping';

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

  await check('seed: la biblioteca lista 3 partidos', async () => {
    const items = await repo.list();
    assert.equal(items.length, 3);
  });

  await check('J24 se lista con marcador reconstruido desde match_event (3-2)', async () => {
    const j24 = (await repo.list()).find((m) => m.matchId === 'J24')!;
    assert.equal(j24.homeGoals, 3);
    assert.equal(j24.awayGoals, 2);
    assert.equal(j24.eventCount, 8);
    assert.equal(j24.status, 'tagging');
  });

  await check('get() reconstruye plantillas y eventos', async () => {
    const m = (await repo.get('J24'))!;
    assert.equal(m.home.name, 'BM Ejemplo');
    assert.equal(m.away.name, 'Club Balonmano Muestra');
    assert.equal(m.home.players.length, 6);
    assert.equal(m.home.players[0].gk, true);        // portero primero
    assert.equal(m.events.length, 8);
    const first = m.events[0];
    assert.equal(first.t, 130);
    assert.equal(first.side, 'HOME');
    assert.equal(first.playerNumber, 7);
    assert.equal(first.type, EventType.SHOT);
    assert.equal(first.outcome, ShotOutcome.GOAL);
    assert.equal(first.zone, 3);
  });

  await check('saveEvents persiste y el marcador se recalcula (3-2 -> 4-2)', async () => {
    const m = (await repo.get('J24'))!;
    const nuevo: UiEvent = { id: 99, t: 300, period: 1, side: 'HOME', playerNumber: 4, type: EventType.SHOT, outcome: ShotOutcome.GOAL, zone: 5 };
    await repo.saveEvents('J24', [...m.events, nuevo]);
    const reload = (await repo.get('J24'))!;
    assert.equal(reload.events.length, 9);
    const item = (await repo.list()).find((x) => x.matchId === 'J24')!;
    assert.equal(item.homeGoals, 4);
  });

  await check('markExtracted persiste read-models y marca el estado', async () => {
    await repo.markExtracted('J24');
    const m = (await repo.get('J24'))!;
    assert.equal(m.status, 'extracted');
    const rm = (await (pool as any).query('SELECT count(*) AS n FROM match_read_model')).rows[0];
    assert.equal(Number(rm.n), 1);
  });

  await check('setVideo guarda el videoRef', async () => {
    await repo.setVideo('J24', '/data/uploads/J24.mp4');
    const m = (await repo.get('J24'))!;
    assert.equal(m.videoRef, '/data/uploads/J24.mp4');
  });

  await check('get() de un id inexistente devuelve null', async () => {
    assert.equal(await repo.get('NO_EXISTE'), null);
  });

  await check('un blocaje atribuido sobrevive al guardar y recargar (regresión)', async () => {
    const m = (await repo.get('J24'))!;
    const blocado: UiEvent = {
      id: 100, t: 800, period: 1, side: 'AWAY', playerNumber: 5,
      type: EventType.SHOT, outcome: ShotOutcome.BLOCKED, zone: null, blockerNumber: 9,
    };
    await repo.saveEvents('J24', [...m.events, blocado]);
    const reload = (await repo.get('J24'))!;
    const found = reload.events.find((e) => e.outcome === ShotOutcome.BLOCKED)!;
    assert.equal(found.blockerNumber, 9);      // se pierde si el payload no lo guarda
  });

  await check('el blocaje recargado puntúa al defensor (+1.0 prior)', async () => {
    const m = (await repo.get('J24'))!;
    const stats = liveStats(
      { matchId: m.matchId, competition: m.competition, matchday: m.matchday, playedAt: m.playedAt },
      m.events, m.home, m.away,
    );
    const blocker = stats.players.find((p) => p.side === 'HOME' && p.number === 9)!;
    assert.equal(blocker.blocks, 1);
    assert.ok(blocker.playScore.breakdown.some((t) => t.term === 'block' && t.contribution === 1));
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
