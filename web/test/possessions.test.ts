import assert from 'node:assert/strict';
import { liveStats, EventType, ShotOutcome, AttackPhase, type UiEvent, type UiTeam, type MatchMeta } from '../lib/handball/mapping';

const home: UiTeam = { name: 'Local', players: [{ number: 1, name: 'GK', gk: true }, { number: 7, name: 'Central' }] };
const away: UiTeam = { name: 'Visitante', players: [{ number: 1, name: 'GK V', gk: true }, { number: 9, name: 'Pivote' }] };
const meta: MatchMeta = { matchId: 'test', playedAt: '2026-01-01T00:00:00.000Z' };

let seq = 0;
const t0 = () => ++seq; // tiempo creciente para el orden
const shot = (side: 'HOME' | 'AWAY', outcome: ShotOutcome, phase?: AttackPhase, isPenalty = false): UiEvent =>
  ({ id: t0(), t: seq, period: 1, side, playerNumber: side === 'HOME' ? 7 : 9, type: EventType.SHOT, outcome, zone: null, phase, isPenalty });
const turnover = (side: 'HOME' | 'AWAY', phase?: AttackPhase): UiEvent =>
  ({ id: t0(), t: seq, period: 1, side, playerNumber: side === 'HOME' ? 7 : 9, type: EventType.TURNOVER, outcome: null, zone: null, phase });
const steal = (side: 'HOME' | 'AWAY'): UiEvent =>
  ({ id: t0(), t: seq, period: 1, side, playerNumber: side === 'HOME' ? 7 : 9, type: EventType.STEAL, outcome: null, zone: null });

const run = (events: UiEvent[]) => liveStats(meta, events, home, away).summary;

let pass = 0, fail = 0;
const check = (name: string, fn: () => void) => {
  try { seq = 0; fn(); console.log(`  \u2713 ${name}`); pass++; }
  catch (err) { console.log(`  \u2717 ${name}`); console.log(`      ${(err as Error).message}`); fail++; }
};

check('cada tiro y cada pérdida del equipo cierra una posesión', () => {
  const s = run([
    shot('HOME', ShotOutcome.GOAL, AttackPhase.POSITIONAL),
    shot('HOME', ShotOutcome.SAVED, AttackPhase.COUNTER),
    turnover('HOME', AttackPhase.POSITIONAL),
  ]);
  assert.equal(s.home.possessions, 3);
  assert.equal(s.home.possessionsByPhase.positional, 2);
  assert.equal(s.home.possessionsByPhase.counter, 1);
  assert.equal(s.home.goalsByPhase.positional, 1);
  assert.equal(s.home.goalsByPhase.counter, 0);
});

check('un robo del rival cierra tu posesión (sin fase)', () => {
  // HOME tiene el balón (tira), AWAY roba a HOME después.
  const s = run([
    shot('HOME', ShotOutcome.MISSED, AttackPhase.POSITIONAL), // HOME poss #1, balón -> AWAY
    steal('HOME'),                                            // HOME roba a AWAY -> cierra 1 poss de AWAY
  ]);
  assert.equal(s.home.possessions, 1);
  assert.equal(s.away.possessions, 1);          // la cerró el robo de HOME
  assert.equal(s.away.possessionsByPhase.positional, 0); // sin fase
  assert.equal(s.away.possessionsByPhase.counter, 0);
});

check('dedup: pérdida y luego robo del mismo balón = UNA posesión', () => {
  const s = run([
    turnover('HOME', AttackPhase.POSITIONAL), // cuenta HOME, balón -> AWAY
    steal('AWAY'),                            // AWAY roba: balón ya era de AWAY -> no dobla
  ]);
  assert.equal(s.home.possessions, 1);
  assert.equal(s.away.steals, 1);             // el robo sí cuenta como stat defensiva
});

check('dedup en orden inverso: robo y luego pérdida del mismo balón = UNA posesión', () => {
  const s = run([
    steal('AWAY'),                            // AWAY roba a HOME -> cierra 1 poss de HOME
    turnover('HOME', AttackPhase.POSITIONAL), // pérdida de HOME, pero el balón ya no era suyo -> no dobla
  ]);
  assert.equal(s.home.possessions, 1);
});

check('el 7 m lleva fase y cuenta como posesión y gol de esa fase', () => {
  const s = run([
    shot('HOME', ShotOutcome.GOAL, AttackPhase.COUNTER, true),
  ]);
  assert.equal(s.home.possessions, 1);
  assert.equal(s.home.possessionsByPhase.counter, 1);
  assert.equal(s.home.goalsByPhase.counter, 1);
  assert.equal(s.home.goals, 1);
});

check('eficiencia por fase = goles/posesiones de la fase', () => {
  const s = run([
    shot('HOME', ShotOutcome.GOAL, AttackPhase.POSITIONAL),
    shot('HOME', ShotOutcome.SAVED, AttackPhase.POSITIONAL),
    shot('HOME', ShotOutcome.GOAL, AttackPhase.COUNTER),
  ]);
  // Posicional: 1 gol / 2 posesiones = 0.5 ; Contra: 1/1 = 1.0
  const posEff = s.home.goalsByPhase.positional / s.home.possessionsByPhase.positional;
  const cntEff = s.home.goalsByPhase.counter / s.home.possessionsByPhase.counter;
  assert.equal(posEff, 0.5);
  assert.equal(cntEff, 1);
  // Espejo defensivo del rival: repliegue = 1 - eff contra del atacante.
  assert.equal(1 - cntEff, 0);
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
