import assert from 'node:assert/strict';
import { buildPlayerCareer } from '../features/catalog/projection';
import { EventType, ShotOutcome, AttackPhase, type UiEvent, type UiTeam } from '../lib/handball/mapping';
import type { LoadedMatch } from '../features/matches/types';
import type { RosterPlayer } from '../features/catalog/types';

// La misma persona (personId 'PERSON-1') juega en Club A (25/26) y ficha por Club B (26/27).
const refs: RosterPlayer[] = [
  { id: 'RP-A', clubId: 'CLUB-A', season: '25/26', number: 7, name: 'Ana', personId: 'PERSON-1', active: true },
  { id: 'RP-B', clubId: 'CLUB-B', season: '26/27', number: 9, name: 'Ana', personId: 'PERSON-1', active: true },
  { id: 'RP-X', clubId: 'CLUB-A', season: '25/26', number: 3, name: 'Otra', personId: 'PERSON-2', active: true },
];

const teamA = (): UiTeam => ({ name: 'Club A', clubId: 'CLUB-A', players: [
  { number: 1, name: 'GK', gk: true, starter: true, playerId: 'A1' },
  { number: 7, name: 'Ana', starter: true, playerId: 'RP-A' },
] });
const teamB = (): UiTeam => ({ name: 'Club B', clubId: 'CLUB-B', players: [
  { number: 1, name: 'GK', gk: true, starter: true, playerId: 'B1' },
  { number: 9, name: 'Ana', starter: true, playerId: 'RP-B' },
] });
const rival = (name: string): UiTeam => ({ name, clubId: 'CLUB-R', players: [
  { number: 1, name: 'GK', gk: true, starter: true, playerId: 'R1' },
] });

let seq = 0;
const goal = (side: 'HOME' | 'AWAY', num: number): UiEvent =>
  ({ id: ++seq, t: seq, period: 1, side, playerNumber: num, type: EventType.SHOT, outcome: ShotOutcome.GOAL, zone: null, phase: AttackPhase.POSITIONAL });
const mk = (id: string, home: UiTeam, away: UiTeam, events: UiEvent[], season: string): LoadedMatch =>
  ({ matchId: id, home, away, events, status: 'tagging', mode: 'video', season, playedAt: '2026-01-01T00:00:00.000Z' } as LoadedMatch);

// En Club A marca 2 goles; en Club B marca 1.
const mA = mk('MA', teamA(), rival('Rival'), [goal('HOME', 7), goal('HOME', 7)], '25/26');
const mB = mk('MB', teamB(), rival('Rival'), [goal('HOME', 9)], '26/27');

let pass = 0, fail = 0;
const check = (name: string, fn: () => void) => {
  try { fn(); console.log(`  \u2713 ${name}`); pass++; }
  catch (err) { console.log(`  \u2717 ${name}`); console.log(`      ${(err as Error).message}`); fail++; }
};

check('la carrera agrega los partidos de todos los clubes de la persona', () => {
  const c = buildPlayerCareer([mA, mB], refs, 'PERSON-1');
  assert.equal(c.name, 'Ana');
  assert.equal(c.totals.games, 2);
  assert.equal(c.totals.goals, 3);   // 2 en A + 1 en B
});

check('desglose por temporada/club', () => {
  const c = buildPlayerCareer([mA, mB], refs, 'PERSON-1');
  assert.equal(c.bySeason.length, 2);
  const b = c.bySeason.find((x) => x.clubId === 'CLUB-B')!;
  const a = c.bySeason.find((x) => x.clubId === 'CLUB-A')!;
  assert.equal(a.card.goals, 2);
  assert.equal(b.card.goals, 1);
  assert.equal(a.season, '25/26');
  assert.equal(b.season, '26/27');
});

check('otra persona no arrastra los partidos de la primera', () => {
  const c = buildPlayerCareer([mA, mB], refs, 'PERSON-2');
  assert.equal(c.totals.games, 0);   // PERSON-2 (dorsal 3) no juega en estos partidos
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
