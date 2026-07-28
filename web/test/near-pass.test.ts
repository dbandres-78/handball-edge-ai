import assert from 'node:assert/strict';
import { EventType, ShotOutcome } from '@handball/core';
import { liveStats, toCanonicalEvents, UiEvent, UiTeam } from '../lib/handball/mapping';

const home: UiTeam = { name: 'BM Ejemplo', players: [
  { number: 1, name: 'A. Portero', gk: true }, { number: 7, name: 'B. Lateral' },
  { number: 4, name: 'C. Central' },
] };
const away: UiTeam = { name: 'Club Muestra', players: [
  { number: 12, name: 'G. Portero', gk: true }, { number: 5, name: 'H. Lateral' },
  { number: 8, name: 'I. Central' },
] };

let id = 0;
const e = (t: number, side: 'HOME' | 'AWAY', num: number | null,
  type: EventType, outcome: ShotOutcome | null = null, zone: number | null = null): UiEvent =>
  ({ id: id++, t, period: 1, side, playerNumber: num, type, outcome, zone });

const meta = { competition: 'Liga', matchday: 1, playedAt: '2026-09-15T17:00:00.000Z' };

let pass = 0, fail = 0;
const check = (name: string, fn: () => void) => {
  try { fn(); console.log(`  \u2713 ${name}`); pass++; }
  catch (err) { console.log(`  \u2717 ${name}`); console.log(`      ${(err as Error).message}`); fail++; }
};

const NP = EventType.NEAR_PASS;

check('cuenta los pases a 10 m por equipo (por volumen)', () => {
  const events: UiEvent[] = [
    e(100, 'HOME', null, NP), e(120, 'HOME', null, NP), e(140, 'HOME', null, NP),
    e(200, 'AWAY', null, NP),
  ];
  const s = liveStats(meta, events, home, away).summary;
  assert.equal(s.home.nearPasses, 3);
  assert.equal(s.away.nearPasses, 1);
});

check('un pase a 10 m es evento de EQUIPO: sin jugador, teamId correcto', () => {
  const canonical = toCanonicalEvents([e(100, 'AWAY', null, NP)], home, away, meta.playedAt);
  assert.equal(canonical[0].type, EventType.NEAR_PASS);
  assert.equal(canonical[0].playerId, null);
  assert.equal(canonical[0].teamId, 'team:away');
});

check('AISLAMIENTO: los pases a 10 m no tocan goles, tiros ni Play Score', () => {
  const base: UiEvent[] = [
    e(130, 'HOME', 7, EventType.SHOT, ShotOutcome.GOAL, 3),
    e(320, 'HOME', 4, EventType.SHOT, ShotOutcome.MISSED),
  ];
  const withPasses: UiEvent[] = [...base,
    e(150, 'HOME', null, NP), e(160, 'HOME', null, NP), e(170, 'AWAY', null, NP)];

  const a = liveStats(meta, base, home, away);
  const b = liveStats(meta, withPasses, home, away);

  // El marcador y los tiros no cambian al añadir pases a 10 m.
  assert.equal(a.summary.home.goals, b.summary.home.goals);
  assert.equal(a.summary.home.shots, b.summary.home.shots);
  // El Play Score de cada jugador es idéntico con y sin pases a 10 m.
  const ps = (st: typeof a) => st.players.map((p) => `${p.playerId}:${p.playScore.total}`).join('|');
  assert.equal(ps(a), ps(b));
  // Pero los pases sí se han contado.
  assert.equal(b.summary.home.nearPasses, 2);
  assert.equal(b.summary.away.nearPasses, 1);
});

check('arranca a 0 cuando no hay pases a 10 m', () => {
  const s = liveStats(meta, [e(130, 'HOME', 7, EventType.SHOT, ShotOutcome.GOAL, 3)], home, away).summary;
  assert.equal(s.home.nearPasses, 0);
  assert.equal(s.away.nearPasses, 0);
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
