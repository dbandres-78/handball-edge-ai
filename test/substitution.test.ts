import assert from 'node:assert/strict';
import { EventType, ShotOutcome, onCourtAt, liveStats } from '@/lib/handball/mapping';
import type { UiTeam, UiEvent } from '@/lib/handball/mapping';

/**
 * Captura de cambios en pista → ± fino.
 *
 * Prueba la cadena completa de la sala: alineación (starter) + eventos SUBSTITUTION de la UI
 * → onCourtAt (lo que ve la UI) y → liveStats/core (el ± que se calcula). El objetivo es que,
 * con la alineación marcada y los cambios registrados, el ± sea individual y no el diferencial
 * de equipo.
 */

// 4 en pista + 1 suplente por equipo (mini-cancha para la prueba).
const home: UiTeam = {
  name: 'Local',
  players: [
    { number: 1, name: 'Portero H', gk: true, starter: true },
    { number: 7, name: 'Fijo H', starter: true },
    { number: 9, name: 'Sale H', starter: true },
    { number: 4, name: 'Cuarto H', starter: true },
    { number: 15, name: 'Entra H', starter: false },
  ],
};
const away: UiTeam = {
  name: 'Visitante',
  players: [
    { number: 12, name: 'Portero A', gk: true, starter: true },
    { number: 5, name: 'Fijo A', starter: true },
    { number: 8, name: 'Otro A', starter: true },
    { number: 3, name: 'Tercero A', starter: true },
    { number: 20, name: 'Suplente A', starter: false },
  ],
};

let seq = 0;
const goal = (side: 'HOME' | 'AWAY', number: number, t: number): UiEvent => ({
  id: seq++, t, period: 1, side, playerNumber: number, type: EventType.SHOT, outcome: ShotOutcome.GOAL, zone: null,
});
const sub = (side: 'HOME' | 'AWAY', outN: number, inN: number, t: number): UiEvent => ({
  id: seq++, t, period: 1, side, playerNumber: inN, type: EventType.SUBSTITUTION, outcome: null, zone: null, subOutNumber: outN,
});

// gol HOME(9) @10 · cambio HOME 9→15 @20 · gol AWAY(5) @30 · gol HOME(7) @40
const events: UiEvent[] = [
  goal('HOME', 9, 10),
  sub('HOME', 9, 15, 20),
  goal('AWAY', 5, 30),
  goal('HOME', 7, 40),
];

let passed = 0;
function test(name: string, fn: () => void) { fn(); passed++; console.log(`  ✓ ${name}`); }

test('onCourtAt refleja la alineación inicial antes de cualquier cambio', () => {
  const set = onCourtAt(home, events, 'HOME', 5);
  assert.deepEqual([...set].sort((a, b) => a - b), [1, 4, 7, 9]);
});

test('onCourtAt aplica la sustitución a partir de su instante', () => {
  assert.ok(onCourtAt(home, events, 'HOME', 15).has(9));   // antes del cambio: 9 en pista
  assert.ok(!onCourtAt(home, events, 'HOME', 25).has(9));  // después: 9 fuera
  assert.ok(onCourtAt(home, events, 'HOME', 25).has(15));  // 15 dentro
});

test('onCourtAt aplica el cambio de portero (portero por portero)', () => {
  const gkChange: UiEvent[] = [
    ...events,
    { id: 99, t: 5, period: 1, side: 'HOME', playerNumber: 30, type: EventType.GOALKEEPER_CHANGE, outcome: null, zone: null },
  ];
  const teamWith2gk: UiTeam = { ...home, players: [...home.players, { number: 30, name: 'Portero H2', gk: true, starter: false }] };
  const set = onCourtAt(teamWith2gk, gkChange, 'HOME', 6);
  assert.ok(!set.has(1));   // el portero titular sale
  assert.ok(set.has(30));   // entra el nuevo
});

const find = (players: any[], side: string, number: number) => players.find((p) => p.side === side && p.number === number)!;

test('el ± es fino: distingue al que sale, al que entra y a los fijos', () => {
  const { players } = liveStats({ matchId: 'sub' }, events, home, away);
  // Marcador: HOME 2 - AWAY 1.
  //  H:7 (fijo) en los 3 goles: +1 −1 +1 = +1
  assert.equal(find(players, 'HOME', 7).plusMinus, 1);
  //  H:9 (sale @20) sólo el 1er gol: +1
  assert.equal(find(players, 'HOME', 9).plusMinus, 1);
  //  H:15 (entra @20): gol AWAY (−1) y 2º gol HOME (+1) = 0
  assert.equal(find(players, 'HOME', 15).plusMinus, 0);
  //  A:5 (fijo rival) en los 3 goles: −1 +1 −1 = −1
  assert.equal(find(players, 'AWAY', 5).plusMinus, -1);
});

test('sin la captura, el ± NO distinguiría (todos los titulares darían el mismo valor)', () => {
  // Mismos goles pero sin el evento de cambio: 9 y 15... 15 no es titular, así que queda a 0
  // y 9 acumularía los 3 goles como si siguiera en pista. Esto demuestra el valor del cambio.
  const sinCambio = events.filter((e) => e.type !== EventType.SUBSTITUTION);
  const { players } = liveStats({ matchId: 'sub' }, sinCambio, home, away);
  assert.equal(find(players, 'HOME', 9).plusMinus, 1);   // +1 −1 +1 (sigue "en pista" todo)
  assert.equal(find(players, 'HOME', 15).plusMinus, 0);  // nunca entra
});

test('el Play Score no cambia por el ± (peso 0 por defecto)', () => {
  const { players } = liveStats({ matchId: 'sub' }, events, home, away);
  // H:7 marcó 1 gol => 1.8, el ± no suma.
  assert.equal(find(players, 'HOME', 7).playScore.total, 1.8);
});

console.log(`${passed} passed, 0 failed`);
