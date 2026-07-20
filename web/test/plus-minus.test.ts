import assert from 'node:assert/strict';
import {
  EventType, ShotOutcome, recomputeAggregates, computePlayScore, PLAY_SCORE_WEIGHTS,
} from '@handball/core';
import type { MatchEvent, ResolvedRoster } from '@handball/core';

/**
 * Plus-minus (±): diferencial de goles del equipo mientras el jugador está en pista.
 *
 * Se prueba la RECONSTRUCCIÓN de en-pista desde eventos canónicos (titulares + SUBSTITUTION),
 * que es la parte con lógica real, con independencia de la UI. También que el ± entra en el
 * Play Score sólo cuando se le asigna un peso (por defecto es 0: solo-visualización).
 */

// Roster: 2 titulares de campo + 1 portero titular + 1 suplente por equipo.
const roster: ResolvedRoster = {
  matchId: 'pm',
  teams: [
    { teamId: 'H', side: 'HOME', name: 'Local' },
    { teamId: 'A', side: 'AWAY', name: 'Visitante' },
  ],
  players: [
    { playerId: 'H:1', teamId: 'H', side: 'HOME', number: 1, name: 'Portero H', position: 'GK', starter: true },
    { playerId: 'H:7', teamId: 'H', side: 'HOME', number: 7, name: 'Titular H', position: 'NA', starter: true },
    { playerId: 'H:9', teamId: 'H', side: 'HOME', number: 9, name: 'Otro H', position: 'NA', starter: true },
    { playerId: 'H:15', teamId: 'H', side: 'HOME', number: 15, name: 'Suplente H', position: 'NA', starter: false },
    { playerId: 'A:12', teamId: 'A', side: 'AWAY', number: 12, name: 'Portero A', position: 'GK', starter: true },
    { playerId: 'A:5', teamId: 'A', side: 'AWAY', number: 5, name: 'Titular A', position: 'NA', starter: true },
    { playerId: 'A:8', teamId: 'A', side: 'AWAY', number: 8, name: 'Otro A', position: 'NA', starter: true },
    { playerId: 'A:20', teamId: 'A', side: 'AWAY', number: 20, name: 'Suplente A', position: 'NA', starter: false },
  ],
};

let seq = 0;
const ev = (teamId: string, playerId: string | null, type: EventType, payload: Record<string, unknown> = {}): MatchEvent => ({
  matchId: 'pm', seq: seq++, ts: new Date(Date.now() + seq * 1000).toISOString(),
  gameClockMs: seq * 1000, period: 1, teamId, playerId, type, payload,
});
const goal = (teamId: string, playerId: string) => ev(teamId, playerId, EventType.SHOT, { outcome: ShotOutcome.GOAL });

const find = (players: any[], id: string) => players.find((p) => p.playerId === id)!;

let passed = 0;
function test(name: string, fn: () => void) { fn(); passed++; console.log(`  ✓ ${name}`); }

// ── Escenario: HOME mete 2, AWAY mete 1. En medio, un cambio en HOME (sale 9, entra 15). ──
// Secuencia temporal:
//   gol HOME (9 en pista)  -> H:1,H:7,H:9 = +1 ; A:12,A:5,A:8 = -1
//   SUB HOME: 9 -> 15
//   gol AWAY (5)           -> A:12,A:5,A:8 = +1 ; H:1,H:7,H:15 = -1  (9 ya NO está)
//   gol HOME (7)           -> H:1,H:7,H:15 = +1 ; A:12,A:5,A:8 = -1
const events: MatchEvent[] = [
  goal('H', 'H:9'),
  ev('H', 'H:15', EventType.SUBSTITUTION, { playerOutId: 'H:9', playerInId: 'H:15' }),
  goal('A', 'A:5'),
  goal('H', 'H:7'),
];

const { players } = recomputeAggregates({ matchId: 'pm', playedAt: new Date().toISOString() }, events, roster);

test('titular que juega todo el partido acumula el ± correcto', () => {
  // H:7 en pista en los 3 goles: +1 (H) −1 (A) +1 (H) = +1
  assert.equal(find(players, 'H:7').plusMinus, 1);
  // H:1 (portero) igual que H:7, en pista todo el partido
  assert.equal(find(players, 'H:1').plusMinus, 1);
});

test('el jugador sustituido sólo cuenta los goles con él en pista', () => {
  // H:9 sólo estuvo para el primer gol (HOME): +1. Sale antes del gol AWAY y del 2º de HOME.
  assert.equal(find(players, 'H:9').plusMinus, 1);
});

test('el suplente que entra sólo cuenta desde su entrada', () => {
  // H:15 entra tras el 1er gol: le tocan gol AWAY (−1) y 2º gol HOME (+1) = 0
  assert.equal(find(players, 'H:15').plusMinus, 0);
});

test('el rival acumula el ± con signo opuesto', () => {
  // A:5 en pista los 3 goles: −1 (H) +1 (A) −1 (H) = −1
  assert.equal(find(players, 'A:5').plusMinus, -1);
  assert.equal(find(players, 'A:12').plusMinus, -1);
});

test('la suma de ± de los en-pista es cero en cada gol (conservación)', () => {
  // Con 3 en pista por equipo y 3 goles: suma total de ± = 0.
  const total = players.reduce((s, p) => s + p.plusMinus, 0);
  assert.equal(total, 0);
});

test('por defecto el ± NO suma al Play Score (peso 0, solo-visualización)', () => {
  assert.equal(PLAY_SCORE_WEIGHTS.plusMinus, 0);
  const h7 = find(players, 'H:7');
  // H:7 marcó 1 gol => 1.8; el ± (+1) con peso 0 no añade nada.
  assert.equal(h7.playScore.total, 1.8);
  assert.ok(!h7.playScore.breakdown.some((t: any) => t.term === 'plusMinus'));
});

test('con un peso asignado, el ± entra como término prior auditable', () => {
  const weighted = { ...PLAY_SCORE_WEIGHTS, plusMinus: 0.5 };
  const ps = computePlayScore({ goals: 1, misses: 0, turnovers: 0, saves: 0, plusMinus: 2 }, weighted);
  const term = ps.breakdown.find((t) => t.term === 'plusMinus')!;
  assert.deepEqual(term, { term: 'plusMinus', count: 2, weight: 0.5, contribution: 1.0, origin: 'prior' });
  assert.equal(ps.priorTotal, 1.0);      // 2 × 0.5
  assert.equal(ps.fittedTotal, 1.8);     // 1 gol
  assert.equal(ps.total, 2.8);
});

test('sin titulares marcados (todos en pista), el ± degrada al diferencial de equipo', () => {
  const allStarters: ResolvedRoster = {
    ...roster,
    players: roster.players.map((p) => ({ ...p, starter: true })),
  };
  const r = recomputeAggregates({ matchId: 'pm', playedAt: new Date().toISOString() }, events, allStarters);
  // HOME 2 - AWAY 1 => todos los de HOME +1, todos los de AWAY −1 (incluidos suplentes "en pista").
  assert.equal(find(r.players, 'H:15').plusMinus, 1);
  assert.equal(find(r.players, 'A:20').plusMinus, -1);
});

console.log(`${passed} passed, 0 failed`);
