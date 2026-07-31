import assert from 'node:assert/strict';
import { buildClubProjection, isLinkedToClub, clubSeasons } from '../features/catalog/projection';
import { EventType, ShotOutcome, AttackPhase, type UiEvent, type UiTeam } from '../lib/handball/mapping';
import type { LoadedMatch } from '../features/matches/types';

const clubA = (): UiTeam => ({ name: 'Club A', clubId: 'CLUB-A', players: [
  { number: 1, name: 'GK A', gk: true, starter: true, playerId: 'A1' },
  { number: 7, name: 'Central A', starter: true, playerId: 'A7' },
] });
const clubB = (): UiTeam => ({ name: 'Club B', clubId: 'CLUB-B', players: [
  { number: 1, name: 'GK B', gk: true, starter: true, playerId: 'B1' },
  { number: 9, name: 'Pivote B', starter: true, playerId: 'B9' },
] });

let seq = 0;
const shot = (side: 'HOME' | 'AWAY', num: number, outcome: ShotOutcome, phase?: AttackPhase): UiEvent =>
  ({ id: ++seq, t: seq, period: 1, side, playerNumber: num, type: EventType.SHOT, outcome, zone: null, phase });
const turnover = (side: 'HOME' | 'AWAY', num: number, phase?: AttackPhase): UiEvent =>
  ({ id: ++seq, t: seq, period: 1, side, playerNumber: num, type: EventType.TURNOVER, outcome: null, zone: null, phase });

const mk = (matchId: string, home: UiTeam, away: UiTeam, events: UiEvent[], season = '26/27'): LoadedMatch =>
  ({ matchId, home, away, events, status: 'tagging', mode: 'video', season, playedAt: '2026-01-01T00:00:00.000Z' } as LoadedMatch);

// Partido 1: A (local) 1 - 0 B — gol posicional de A#7.
const m1 = mk('M1', clubA(), clubB(), [shot('HOME', 7, ShotOutcome.GOAL, AttackPhase.POSITIONAL)]);
// Partido 2: B (local) 0 - 1 A — A#7 marca en contra y pierde una posicional.
const m2 = mk('M2', clubB(), clubA(), [
  shot('AWAY', 7, ShotOutcome.GOAL, AttackPhase.COUNTER),
  turnover('AWAY', 7, AttackPhase.POSITIONAL),
]);
// Partido de otra temporada (no debe contar).
const mOld = mk('M3', clubA(), clubB(), [shot('HOME', 7, ShotOutcome.GOAL, AttackPhase.POSITIONAL)], '25/26');

let pass = 0, fail = 0;
const check = (name: string, fn: () => void) => {
  try { fn(); console.log(`  \u2713 ${name}`); pass++; }
  catch (err) { console.log(`  \u2717 ${name}`); console.log(`      ${(err as Error).message}`); fail++; }
};

check('isLinkedToClub filtra por club y temporada', () => {
  assert.equal(isLinkedToClub(m1, 'CLUB-A', '26/27'), true);
  assert.equal(isLinkedToClub(m2, 'CLUB-A', '26/27'), true);   // A juega de visitante
  assert.equal(isLinkedToClub(mOld, 'CLUB-A', '26/27'), false); // otra temporada
  assert.equal(isLinkedToClub(m1, 'CLUB-B', '26/27'), true);
});

check('clubSeasons lista las temporadas del club', () => {
  assert.deepEqual(clubSeasons([m1, m2, mOld], 'CLUB-A'), ['26/27', '25/26']);
});

check('ficha de equipo: récord, goles y medias', () => {
  const p = buildClubProjection([m1, m2, mOld], 'CLUB-A', '26/27');
  assert.equal(p.games, 2);
  assert.equal(p.team.wins, 2);
  assert.equal(p.team.losses, 0);
  assert.equal(p.team.goalsFor, 2);
  assert.equal(p.team.goalsAgainst, 0);
  assert.equal(p.team.goalsForAvg, 1);
  // Play Score del equipo = suma de los de sus jugadores.
  const sumPS = p.players.reduce((s, x) => s + x.playScoreTotal, 0);
  assert.equal(p.team.playScoreTotal, Math.round(sumPS * 100) / 100);
  assert.equal(p.team.playScoreAvg, Math.round((p.team.playScoreTotal / p.team.games) * 100) / 100);
});

check('ficha de jugador: agregación y eficacias on-court por fase', () => {
  const p = buildClubProjection([m1, m2], 'CLUB-A', '26/27');
  const a7 = p.players.find((x) => x.playerId === 'A7')!;
  assert.ok(a7, 'A7 presente');
  assert.equal(a7.games, 2);
  assert.equal(a7.goals, 2);
  assert.equal(a7.shots, 2);
  assert.equal(a7.turnovers, 1);
  // offPoss = 1 (m1 gol) + 2 (m2 gol+pérdida) = 3 → tasa de pérdidas 1/3
  assert.equal(a7.turnoverRate, 33.3);
  // Ataque posicional: goles/posesiones = 1/2 = 50 ; contraataque = 1/1 = 100
  assert.equal(a7.eff.offensive, 50);
  assert.equal(a7.eff.counter, 100);
  assert.ok(a7.playScoreTotal !== 0);
  assert.equal(a7.playScoreAvg, Math.round((a7.playScoreTotal / 2) * 100) / 100);
});

check('el ranking del equipo ordena por Play Score', () => {
  const p = buildClubProjection([m1, m2], 'CLUB-A', '26/27');
  assert.ok(p.team.ranking.length >= 1);
  const scores = p.team.ranking.map((r) => r.playScoreTotal);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
