import assert from 'node:assert/strict';
import { liveStats, EventType, ShotOutcome, type UiEvent, type UiTeam, type MatchMeta } from '../lib/handball/mapping';

const home: UiTeam = { name: 'Local', players: [
  { number: 1, name: 'GK', gk: true, starter: true },
  { number: 7, name: 'Central', starter: true },
  { number: 11, name: 'Suplente', starter: false },
] };
const away: UiTeam = { name: 'Visitante', players: [
  { number: 1, name: 'GK V', gk: true, starter: true },
  { number: 9, name: 'Pivote', starter: true },
] };
const meta: MatchMeta = { matchId: 'test', playedAt: '2026-01-01T00:00:00.000Z' };

const shot = (side: 'HOME' | 'AWAY', num: number, t: number): UiEvent =>
  ({ id: t, t, period: 1, side, playerNumber: num, type: EventType.SHOT, outcome: ShotOutcome.GOAL, zone: null });
const sub = (side: 'HOME' | 'AWAY', outN: number, inN: number, t: number): UiEvent =>
  ({ id: t, t, period: 1, side, playerNumber: inN, type: EventType.SUBSTITUTION, outcome: null, zone: null, subOutNumber: outN });

const min = (events: UiEvent[], side: 'HOME' | 'AWAY', num: number) =>
  liveStats(meta, events, home, away).players.find((p) => p.side === side && p.number === num)!.minutesPlayed;

let pass = 0, fail = 0;
const check = (name: string, fn: () => void) => {
  try { fn(); console.log(`  \u2713 ${name}`); pass++; }
  catch (err) { console.log(`  \u2717 ${name}`); console.log(`      ${(err as Error).message}`); fail++; }
};

// #7 titular hasta el minuto 10 (cambio), #11 entra y juega hasta el 15 (última acción). #9 todo.
const events = [
  shot('HOME', 7, 300),        // 5:00
  sub('HOME', 7, 11, 600),     // 10:00 sale #7, entra #11
  shot('HOME', 11, 900),       // 15:00 última acción
];

check('un titular sustituido acumula hasta el cambio', () => {
  assert.equal(min(events, 'HOME', 7), 10);   // 0 → 600 s = 10 min
});
check('un suplente que entra acumula desde el cambio hasta el final', () => {
  assert.equal(min(events, 'HOME', 11), 5);   // 600 → 900 s = 5 min
});
check('un titular que no sale juega hasta la última acción', () => {
  assert.equal(min(events, 'AWAY', 9), 15);   // 0 → 900 s = 15 min
});
check('sin eventos, nadie acumula minutos', () => {
  assert.equal(min([], 'HOME', 7), 0);
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
