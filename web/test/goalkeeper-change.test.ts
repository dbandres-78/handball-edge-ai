import assert from 'node:assert/strict';
import { EventType, ShotOutcome } from '../../src/ingestion/domain/match-event';
import { liveStats, toCanonicalEvents, buildRoster, UiEvent, UiTeam } from '../lib/handball/mapping';
import { recomputeAggregates } from '../../src/ingestion/application/recompute-aggregates';

/**
 * Tests para el punto 2 — portero en pista dinámico.
 *
 * Escenario: un partido donde el equipo HOME tiene 2 porteros (#1 y #12).
 * A mitad de partido, se emite un GOALKEEPER_CHANGE para poner a #12.
 * Los tiros parados del rival ANTES del cambio deben atribuirse a #1,
 * y los de DESPUÉS al #12.
 */

const home: UiTeam = { name: 'BM Ejemplo', players: [
  { number: 1, name: 'Portero A', gk: true },
  { number: 12, name: 'Portero B', gk: true },
  { number: 7, name: 'Lateral' },
  { number: 4, name: 'Central' },
  { number: 9, name: 'Pivote' },
] };

const away: UiTeam = { name: 'CB Rival', players: [
  { number: 1, name: 'Portero C', gk: true },
  { number: 16, name: 'Portero D', gk: true },
  { number: 5, name: 'Lateral' },
  { number: 8, name: 'Central' },
  { number: 11, name: 'Extremo' },
] };

let id = 0;
const e = (t: number, period: number, side: 'HOME' | 'AWAY', num: number | null,
  type: EventType, outcome: ShotOutcome | null = null, zone: number | null = null): UiEvent =>
  ({ id: id++, t, period, side, playerNumber: num, type, outcome, zone });

const meta = { competition: 'Test', matchday: 1, playedAt: '2025-06-01T17:00:00.000Z' };

type Fn = () => void;
const tests: Array<[string, Fn]> = [];
const test = (n: string, f: Fn) => tests.push([n, f]);
const find = (players: any[], side: string, number: number) =>
  players.find((p: any) => p.side === side && p.number === number);

test('sin GOALKEEPER_CHANGE, las paradas van al primer portero (fallback)', () => {
  const events: UiEvent[] = [
    e(60, 1, 'AWAY', 5, EventType.SHOT, ShotOutcome.SAVED),   // parada de HOME:portero → #1
    e(120, 1, 'AWAY', 8, EventType.SHOT, ShotOutcome.SAVED),  // parada de HOME:portero → #1
    e(180, 1, 'HOME', 7, EventType.SHOT, ShotOutcome.SAVED),  // parada de AWAY:portero → #1
  ];
  const { players } = liveStats(meta, events, home, away);
  assert.equal(find(players, 'HOME', 1).saves, 2, 'Portero A (HOME #1) debe tener 2 paradas');
  assert.equal(find(players, 'HOME', 12).saves, 0, 'Portero B (HOME #12) no debe tener paradas');
  assert.equal(find(players, 'AWAY', 1).saves, 1, 'Portero C (AWAY #1) debe tener 1 parada');
});

test('tras GOALKEEPER_CHANGE, las paradas se reparten entre los dos porteros', () => {
  id = 0;
  const events: UiEvent[] = [
    // Primera parte: portero #1 de HOME en pista (por defecto)
    e(60, 1, 'AWAY', 5, EventType.SHOT, ShotOutcome.SAVED),   // → HOME #1 para
    e(120, 1, 'AWAY', 8, EventType.SHOT, ShotOutcome.SAVED),  // → HOME #1 para

    // Cambio de portero a #12 en el minuto ~3
    e(180, 1, 'HOME', 12, EventType.GOALKEEPER_CHANGE),

    // Segunda parte: portero #12 de HOME en pista
    e(240, 1, 'AWAY', 11, EventType.SHOT, ShotOutcome.SAVED), // → HOME #12 para
    e(300, 1, 'AWAY', 5, EventType.SHOT, ShotOutcome.SAVED),  // → HOME #12 para
    e(360, 1, 'AWAY', 8, EventType.SHOT, ShotOutcome.SAVED),  // → HOME #12 para
  ];

  const { players } = liveStats(meta, events, home, away);
  const gk1 = find(players, 'HOME', 1);
  const gk12 = find(players, 'HOME', 12);

  assert.equal(gk1.saves, 2, 'Portero A (HOME #1) debe tener 2 paradas (antes del cambio)');
  assert.equal(gk12.saves, 3, 'Portero B (HOME #12) debe tener 3 paradas (después del cambio)');
});

test('el GOALKEEPER_CHANGE afecta solo al equipo indicado', () => {
  id = 0;
  const events: UiEvent[] = [
    e(60, 1, 'AWAY', 5, EventType.SHOT, ShotOutcome.SAVED),    // HOME #1 para
    e(90, 1, 'HOME', 7, EventType.SHOT, ShotOutcome.SAVED),    // AWAY #1 para

    // Cambio: HOME pone a #12, AWAY no cambia
    e(120, 1, 'HOME', 12, EventType.GOALKEEPER_CHANGE),

    e(180, 1, 'AWAY', 8, EventType.SHOT, ShotOutcome.SAVED),   // HOME #12 para (cambió)
    e(240, 1, 'HOME', 4, EventType.SHOT, ShotOutcome.SAVED),   // AWAY #1 para (no cambió)
  ];

  const { players } = liveStats(meta, events, home, away);
  assert.equal(find(players, 'HOME', 1).saves, 1, 'HOME #1 solo 1 parada');
  assert.equal(find(players, 'HOME', 12).saves, 1, 'HOME #12 tiene 1 parada post-cambio');
  assert.equal(find(players, 'AWAY', 1).saves, 2, 'AWAY #1 sigue con 2 paradas (no cambió)');
});

test('múltiples cambios de portero a lo largo del partido', () => {
  id = 0;
  const events: UiEvent[] = [
    e(60, 1, 'AWAY', 5, EventType.SHOT, ShotOutcome.SAVED),     // HOME #1
    e(120, 1, 'HOME', 12, EventType.GOALKEEPER_CHANGE),
    e(180, 1, 'AWAY', 8, EventType.SHOT, ShotOutcome.SAVED),    // HOME #12
    e(240, 1, 'HOME', 1, EventType.GOALKEEPER_CHANGE),           // vuelve #1
    e(300, 1, 'AWAY', 11, EventType.SHOT, ShotOutcome.SAVED),   // HOME #1
    e(360, 1, 'HOME', 12, EventType.GOALKEEPER_CHANGE),          // otra vez #12
    e(420, 1, 'AWAY', 5, EventType.SHOT, ShotOutcome.SAVED),    // HOME #12
  ];

  const { players } = liveStats(meta, events, home, away);
  assert.equal(find(players, 'HOME', 1).saves, 2, 'HOME #1: 2 paradas');
  assert.equal(find(players, 'HOME', 12).saves, 2, 'HOME #12: 2 paradas');
});

test('paridad exacta se mantiene con GOALKEEPER_CHANGE', () => {
  id = 0;
  const events: UiEvent[] = [
    e(60, 1, 'AWAY', 5, EventType.SHOT, ShotOutcome.SAVED),
    e(120, 1, 'HOME', 12, EventType.GOALKEEPER_CHANGE),
    e(180, 1, 'AWAY', 8, EventType.SHOT, ShotOutcome.SAVED),
    e(240, 1, 'HOME', 7, EventType.SHOT, ShotOutcome.GOAL, 3),
  ];

  const roster = buildRoster(home, away, 'live');
  const canonical = toCanonicalEvents(events, home, away, meta.playedAt!, 'live');
  const direct = recomputeAggregates(
    { matchId: 'live', playedAt: meta.playedAt!, competition: meta.competition, matchday: meta.matchday },
    canonical, roster,
  );
  assert.deepEqual(liveStats(meta, events, home, away), direct);
});

test('el Play Score del portero refleja solo sus paradas tras rotación', () => {
  id = 0;
  const events: UiEvent[] = [
    e(60, 1, 'AWAY', 5, EventType.SHOT, ShotOutcome.SAVED),     // HOME #1 → 1 parada
    e(120, 1, 'HOME', 12, EventType.GOALKEEPER_CHANGE),
    e(180, 1, 'AWAY', 8, EventType.SHOT, ShotOutcome.SAVED),    // HOME #12 → 1 parada
    e(240, 1, 'AWAY', 11, EventType.SHOT, ShotOutcome.SAVED),   // HOME #12 → 2 paradas
  ];

  const { players } = liveStats(meta, events, home, away);
  const gk1 = find(players, 'HOME', 1);
  const gk12 = find(players, 'HOME', 12);

  // 1 parada × 1.84 = 1.84
  assert.equal(gk1.playScore.total, 1.84, 'Play Score de HOME #1: 1 parada');
  // 2 paradas × 1.84 = 3.68
  assert.equal(gk12.playScore.total, 3.68, 'Play Score de HOME #12: 2 paradas');
});

test('defaultRoster genera 16 jugadores con #1 y #12 como porteros', () => {
  // Simular la lógica del defaultRoster del API
  const defaultRoster = (count: number) => {
    const n = Math.min(Math.max(count, 7), 16);
    return Array.from({ length: n }, (_, i) => {
      const number = i + 1;
      const isGk = number === 1 || number === 12;
      return { number, name: isGk ? `Portero ${number}` : `Jugador ${number}`, gk: isGk };
    });
  };

  const roster = defaultRoster(16);
  assert.equal(roster.length, 16);
  assert.ok(roster[0].gk, '#1 es portero');
  assert.equal(roster[0].name, 'Portero 1');
  assert.ok(roster[11].gk, '#12 es portero');
  assert.equal(roster[11].name, 'Portero 12');
  assert.ok(!roster[1].gk, '#2 no es portero');
  assert.ok(!roster[6].gk, '#7 no es portero');

  // Con count bajo, se fuerza mínimo 7
  const small = defaultRoster(3);
  assert.equal(small.length, 7);

  // Con count alto, se limita a 16
  const big = defaultRoster(20);
  assert.equal(big.length, 16);
});

let pass = 0, fail = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log(`  \u2713 ${name}`); pass++; }
  catch (err) { console.log(`  \u2717 ${name}`); console.log(`      ${(err as Error).message}`); fail++; }
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
