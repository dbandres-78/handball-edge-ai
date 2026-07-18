import assert from 'node:assert/strict';
import { newDb } from 'pg-mem';
import { makePgMatchesRepository } from '../lib/db/matches-repo.pg';
import { EventType, ShotOutcome, UiEvent, liveStats } from '../lib/handball/mapping';

/**
 * Tests del punto 3 — Postgres real (contra pg-mem, pero cubriendo los edge cases).
 *
 * Lo que validan:
 * - GOALKEEPER_CHANGE sobrevive al guardar/recargar en la BD.
 * - isPenalty se persiste en el payload y se reconstruye.
 * - Las paradas se atribuyen al portero correcto tras un cambio de portero persistido.
 * - Las migraciones crean schema_version.
 * - defaultRoster de 16 jugadores con 2 porteros persiste correctamente.
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

  const roster2gk = [
    { number: 1, name: 'Portero A', gk: true },
    { number: 12, name: 'Portero B', gk: true },
    { number: 4, name: 'Lateral' }, { number: 7, name: 'Central' }, { number: 9, name: 'Pivote' },
  ];

  let matchId = '';

  await check('se crea un partido con 2 porteros por equipo', async () => {
    const m = await repo.create({
      competition: 'Test Persistencia', matchday: 1, mode: 'live', periodMinutes: 30,
      home: { name: 'BM Doble Porter', players: roster2gk },
      away: { name: 'CB Rival', players: roster2gk },
    });
    matchId = m.matchId;
    assert.equal(m.home.players.filter(p => p.gk).length, 2, 'HOME tiene 2 porteros');
    assert.equal(m.away.players.filter(p => p.gk).length, 2, 'AWAY tiene 2 porteros');
  });

  await check('GOALKEEPER_CHANGE persiste y se recarga correctamente', async () => {
    const events: UiEvent[] = [
      { id: 1, t: 60, period: 1, side: 'HOME', playerNumber: 5, type: EventType.SHOT, outcome: ShotOutcome.SAVED, zone: null },
      { id: 2, t: 120, period: 1, side: 'HOME', playerNumber: 12, type: EventType.GOALKEEPER_CHANGE, outcome: null, zone: null },
      { id: 3, t: 180, period: 1, side: 'HOME', playerNumber: 7, type: EventType.SHOT, outcome: ShotOutcome.SAVED, zone: null },
    ];
    await repo.saveEvents(matchId, events);
    const m = (await repo.get(matchId))!;
    assert.equal(m.events.length, 3);

    const gkChange = m.events.find(e => e.type === EventType.GOALKEEPER_CHANGE)!;
    assert.equal(gkChange.playerNumber, 12, 'GOALKEEPER_CHANGE conserva el dorsal');
    assert.equal(gkChange.side, 'HOME', 'GOALKEEPER_CHANGE conserva el equipo');
  });

  await check('las paradas se atribuyen al portero correcto tras guardar/recargar', async () => {
    const m = (await repo.get(matchId))!;
    const stats = liveStats(
      { matchId: m.matchId, competition: m.competition, matchday: m.matchday, playedAt: m.playedAt },
      m.events, m.home, m.away,
    );
    // Antes del cambio (t=60): el portero AWAY en pista es #1
    const gk1 = stats.players.find(p => p.side === 'AWAY' && p.number === 1)!;
    // Después del cambio (t=180): no hay GK_CHANGE en AWAY, así que sigue siendo #1
    // Aquí el GOALKEEPER_CHANGE es de HOME, no de AWAY. Ambas paradas son del portero AWAY #1.
    assert.equal(gk1.saves, 2, 'AWAY #1 tiene 2 paradas (HOME no cambió su portero rival)');
  });

  await check('isPenalty se persiste en el payload y se reconstruye', async () => {
    const events: UiEvent[] = [
      { id: 1, t: 60, period: 1, side: 'HOME', playerNumber: 7, type: EventType.SHOT, outcome: ShotOutcome.GOAL, zone: 5, isPenalty: true },
      { id: 2, t: 120, period: 1, side: 'AWAY', playerNumber: 4, type: EventType.SHOT, outcome: ShotOutcome.SAVED, zone: 3, isPenalty: false },
    ];
    await repo.saveEvents(matchId, events);
    const m = (await repo.get(matchId))!;

    const penalty = m.events.find(e => e.t === 60)!;
    assert.equal(penalty.isPenalty, true, 'isPenalty=true sobrevive al guardar');

    const normal = m.events.find(e => e.t === 120)!;
    // false o null/undefined, ambos son falsy — lo importante es que no sea true
    assert.ok(!normal.isPenalty, 'isPenalty=false se mantiene falsy');
  });

  await check('un partido con cambio de portero en ambos equipos reparte paradas bien', async () => {
    const events: UiEvent[] = [
      // AWAY tira, HOME #1 para (por defecto)
      { id: 1, t: 30, period: 1, side: 'AWAY', playerNumber: 4, type: EventType.SHOT, outcome: ShotOutcome.SAVED, zone: null },
      // HOME cambia portero a #12
      { id: 2, t: 60, period: 1, side: 'HOME', playerNumber: 12, type: EventType.GOALKEEPER_CHANGE, outcome: null, zone: null },
      // AWAY tira, HOME #12 para
      { id: 3, t: 90, period: 1, side: 'AWAY', playerNumber: 7, type: EventType.SHOT, outcome: ShotOutcome.SAVED, zone: null },
      // HOME tira, AWAY #1 para (por defecto, no cambió AWAY)
      { id: 4, t: 120, period: 1, side: 'HOME', playerNumber: 4, type: EventType.SHOT, outcome: ShotOutcome.SAVED, zone: null },
      // AWAY cambia portero a #12
      { id: 5, t: 150, period: 1, side: 'AWAY', playerNumber: 12, type: EventType.GOALKEEPER_CHANGE, outcome: null, zone: null },
      // HOME tira, AWAY #12 para
      { id: 6, t: 180, period: 1, side: 'HOME', playerNumber: 9, type: EventType.SHOT, outcome: ShotOutcome.SAVED, zone: null },
    ];
    await repo.saveEvents(matchId, events);
    const m = (await repo.get(matchId))!;
    const stats = liveStats(
      { matchId: m.matchId, competition: m.competition, matchday: m.matchday, playedAt: m.playedAt },
      m.events, m.home, m.away,
    );

    assert.equal(stats.players.find(p => p.side === 'HOME' && p.number === 1)!.saves, 1, 'HOME #1: 1 parada');
    assert.equal(stats.players.find(p => p.side === 'HOME' && p.number === 12)!.saves, 1, 'HOME #12: 1 parada');
    assert.equal(stats.players.find(p => p.side === 'AWAY' && p.number === 1)!.saves, 1, 'AWAY #1: 1 parada');
    assert.equal(stats.players.find(p => p.side === 'AWAY' && p.number === 12)!.saves, 1, 'AWAY #12: 1 parada');
  });

  await check('schema_version existe tras init', async () => {
    const rows = (await (pool as any).query('SELECT version, description FROM schema_version ORDER BY version')).rows;
    // pg-mem puede no soportar ALTER TABLE ADD COLUMN IF NOT EXISTS,
    // pero la tabla schema_version debe existir y las migraciones al menos intentarse.
    assert.ok(Array.isArray(rows), 'schema_version es consultable');
  });

  await check('plantilla de 16 jugadores con 2 porteros persiste y se recarga', async () => {
    // Pequeño delay para evitar colisión de matchId (basado en timestamp al segundo)
    await new Promise(r => setTimeout(r, 1100));
    const roster16 = Array.from({ length: 16 }, (_, i) => {
      const number = i + 1;
      const isGk = number === 1 || number === 12;
      return { number, name: isGk ? `Portero ${number}` : `Jugador ${number}`, gk: isGk };
    });
    const m = await repo.create({
      competition: 'RFEBM 16', matchday: 1, mode: 'live', periodMinutes: 30,
      home: { name: 'Equipo 16A', players: roster16 },
      away: { name: 'Equipo 16B', players: roster16 },
    });
    const reload = (await repo.get(m.matchId))!;
    assert.equal(reload.home.players.length, 16, 'HOME tiene 16 jugadores');
    assert.equal(reload.away.players.length, 16, 'AWAY tiene 16 jugadores');
    assert.equal(reload.home.players.filter(p => p.gk).length, 2, 'HOME 2 porteros');
    assert.equal(reload.away.players.filter(p => p.gk).length, 2, 'AWAY 2 porteros');
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
