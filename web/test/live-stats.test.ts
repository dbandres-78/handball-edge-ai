import assert from 'node:assert/strict';
import { EventType, ShotOutcome } from '../../src/ingestion/domain/match-event';
import { liveStats, toCanonicalEvents, buildRoster, UiEvent, UiTeam } from '../lib/handball/mapping';
import { recomputeAggregates } from '../../src/ingestion/application/recompute-aggregates';

const S = EventType.SHOT;
const home: UiTeam = { name: 'BM Ejemplo', players: [
  { number: 1, name: 'A. Portero', gk: true }, { number: 7, name: 'B. Lateral' },
  { number: 4, name: 'C. Central' }, { number: 10, name: 'D. Extremo' },
  { number: 9, name: 'E. Pivote' }, { number: 3, name: 'F. Suplente' },
] };
const away: UiTeam = { name: 'Club Balonmano Muestra', players: [
  { number: 12, name: 'G. Portero', gk: true }, { number: 5, name: 'H. Lateral' },
  { number: 8, name: 'I. Central' }, { number: 11, name: 'J. Extremo' },
  { number: 6, name: 'K. Pivote' }, { number: 2, name: 'L. Suplente' },
] };

let id = 0;
const e = (t: number, period: number, side: 'HOME' | 'AWAY', num: number | null,
  type: EventType, outcome: ShotOutcome | null = null, zone: number | null = null): UiEvent =>
  ({ id: id++, t, period, side, playerNumber: num, type, outcome, zone });

const events: UiEvent[] = [
  e(130, 1, 'HOME', 7, S, ShotOutcome.GOAL, 3),
  e(185, 1, 'AWAY', 11, S, ShotOutcome.SAVED),
  e(320, 1, 'HOME', 10, S, ShotOutcome.GOAL, 1),
  e(360, 1, 'AWAY', 5, S, ShotOutcome.GOAL, 9),
  e(510, 1, 'HOME', 7, EventType.TURNOVER),
  e(555, 1, 'AWAY', 8, EventType.STEAL),
  e(640, 1, 'HOME', 9, S, ShotOutcome.GOAL, 6),
  e(720, 1, 'AWAY', 11, S, ShotOutcome.GOAL, 2),
  e(865, 1, 'HOME', 4, S, ShotOutcome.MISSED),
  e(910, 1, 'AWAY', 6, EventType.TWO_MINUTES),
  e(1065, 1, 'HOME', 7, S, ShotOutcome.GOAL, 4),
  e(1200, 1, 'AWAY', 5, S, ShotOutcome.SAVED),
  e(1935, 2, 'HOME', 10, S, ShotOutcome.GOAL, 5),
  e(2040, 2, 'AWAY', 11, S, ShotOutcome.GOAL, 7),
  e(2190, 2, 'HOME', 9, EventType.TURNOVER),
  e(2290, 2, 'AWAY', 8, S, ShotOutcome.GOAL, 3),
  e(2460, 2, 'HOME', 3, S, ShotOutcome.GOAL, 8),
  e(2700, 2, 'HOME', 7, EventType.YELLOW_CARD),
  e(2850, 2, 'AWAY', 11, S, ShotOutcome.SAVED),
  e(2940, 2, 'HOME', null, EventType.TIMEOUT),
];

const meta = { competition: 'Liga ASOBAL', matchday: 24, playedAt: '2025-03-15T17:00:00.000Z' };

type Fn = () => void;
const tests: Array<[string, Fn]> = [];
const test = (n: string, f: Fn) => tests.push([n, f]);
const find = (players: any[], side: string, number: number) =>
  players.find((p) => p.side === side && p.number === number);

test('la ruta UI reproduce el marcador y las paradas de la J24', () => {
  const { summary } = liveStats(meta, events, home, away);
  assert.equal(summary.home.goals, 6);
  assert.equal(summary.away.goals, 4);
  assert.equal(summary.home.shots, 7);
  assert.equal(summary.away.shots, 7);
  assert.equal(summary.home.saves, 3);
  assert.equal(summary.home.savePct, 0.4286);
  assert.equal(summary.home.timeouts, 1);
  assert.equal(summary.home.yellowCards, 1);
  assert.equal(summary.away.twoMinutes, 1);
});

test('Play Score idéntico al backend (núcleo ajustado)', () => {
  const { players } = liveStats(meta, events, home, away);
  assert.equal(find(players, 'HOME', 1).playScore.total, 5.52);   // 3 paradas × 1.84
  assert.equal(find(players, 'HOME', 7).playScore.total, 3.05);   // 2 goles − 1 pérdida (amarilla no puntúa)
  assert.equal(find(players, 'AWAY', 11).playScore.total, 1.6);   // 2 goles − 2 fallos
});

test('los términos defensivos puntúan y se separan del núcleo ajustado', () => {
  const { players } = liveStats(meta, events, home, away);

  const cb = find(players, 'AWAY', 8);                             // 1 gol + 1 recuperación
  assert.equal(cb.playScore.total, 3.2);
  assert.equal(cb.playScore.fittedTotal, 1.8);
  assert.equal(cb.playScore.priorTotal, 1.4);

  const excl = find(players, 'AWAY', 6);                           // solo una exclusión de 2'
  assert.equal(excl.playScore.total, -1.2);
  assert.equal(excl.playScore.breakdown[0].origin, 'prior');
});

test('paridad exacta: liveStats == recomputeAggregates directo (sin drift)', () => {
  const roster = buildRoster(home, away, 'live');
  const canonical = toCanonicalEvents(events, home, away, meta.playedAt!, 'live');
  const direct = recomputeAggregates(
    { matchId: 'live', playedAt: meta.playedAt!, competition: meta.competition, matchday: meta.matchday },
    canonical, roster,
  );
  assert.deepEqual(liveStats(meta, events, home, away), direct);
});

let pass = 0, fail = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log(`  \u2713 ${name}`); pass++; }
  catch (err) { console.log(`  \u2717 ${name}`); console.log(`      ${(err as Error).message}`); fail++; }
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
