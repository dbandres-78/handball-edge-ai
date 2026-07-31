import assert from 'node:assert/strict';
import { liveStats, EventType, ShotOutcome, AttackPhase, type UiEvent, type UiTeam, type MatchMeta } from '../lib/handball/mapping';

// Titulares marcados → on-court = titulares; #11 es suplente (sin minutos hasta que entre).
const home: UiTeam = { name: 'Local', players: [
  { number: 1, name: 'GK', gk: true, starter: true },
  { number: 7, name: 'Central', starter: true },
  { number: 8, name: 'Lateral', starter: true },
  { number: 11, name: 'Suplente', starter: false },
] };
const away: UiTeam = { name: 'Visitante', players: [
  { number: 1, name: 'GK V', gk: true, starter: true },
  { number: 9, name: 'Pivote', starter: true },
] };
const meta: MatchMeta = { matchId: 'test', playedAt: '2026-01-01T00:00:00.000Z' };

let seq = 0;
const shot = (side: 'HOME' | 'AWAY', num: number, outcome: ShotOutcome, phase?: AttackPhase): UiEvent =>
  ({ id: ++seq, t: seq, period: 1, side, playerNumber: num, type: EventType.SHOT, outcome, zone: null, phase });
const turnover = (side: 'HOME' | 'AWAY', num: number, phase?: AttackPhase): UiEvent =>
  ({ id: ++seq, t: seq, period: 1, side, playerNumber: num, type: EventType.TURNOVER, outcome: null, zone: null, phase });
const steal = (side: 'HOME' | 'AWAY', num: number): UiEvent =>
  ({ id: ++seq, t: seq, period: 1, side, playerNumber: num, type: EventType.STEAL, outcome: null, zone: null });
const sub = (side: 'HOME' | 'AWAY', outN: number, inN: number): UiEvent =>
  ({ id: ++seq, t: seq, period: 1, side, playerNumber: inN, type: EventType.SUBSTITUTION, outcome: null, zone: null, subOutNumber: outN });

const oc = (events: UiEvent[], side: 'HOME' | 'AWAY', num: number) => {
  const pl = liveStats(meta, events, home, away).players.find((p) => p.side === side && p.number === num)!;
  return pl.onCourt;
};

let pass = 0, fail = 0;
const check = (name: string, fn: () => void) => {
  try { seq = 0; fn(); console.log(`  \u2713 ${name}`); pass++; }
  catch (err) { console.log(`  \u2717 ${name}`); console.log(`      ${(err as Error).message}`); fail++; }
};

const base = () => [
  shot('HOME', 7, ShotOutcome.GOAL, AttackPhase.POSITIONAL),   // home poss posic. con gol
  shot('HOME', 8, ShotOutcome.SAVED, AttackPhase.COUNTER),     // home poss contra sin gol
  shot('AWAY', 9, ShotOutcome.GOAL, AttackPhase.POSITIONAL),   // away poss posic. con gol (home encaja)
  turnover('HOME', 7, AttackPhase.POSITIONAL),                 // home poss posic. sin gol
];

check('titular acumula posesiones ofensivas y defensivas por fase con él en pista', () => {
  const s = oc(base(), 'HOME', 7);
  assert.equal(s.offPoss, 3);          // gol + parada + pérdida
  assert.equal(s.offPosPoss, 2);       // gol + pérdida
  assert.equal(s.offPosGoals, 1);      // el gol
  assert.equal(s.offCntPoss, 1);       // la parada
  assert.equal(s.offCntGoals, 0);
  assert.equal(s.defPoss, 1);          // la posesión del rival mientras estaba en pista
  assert.equal(s.defPosPoss, 1);
  assert.equal(s.defPosGoals, 1);      // gol encajado en defensa posicional
  assert.equal(s.defCntPoss, 0);
});

check('un suplente que no entra no acumula nada', () => {
  const s = oc(base(), 'HOME', 11);
  assert.equal(s.offPoss, 0);
  assert.equal(s.defPoss, 0);
  assert.equal(s.offPosPoss, 0);
});

check('posesión cerrada por robo entra en el total pero no en el desglose por fase', () => {
  // AWAY roba a HOME: cierra una posesión ofensiva de HOME sin fase.
  const s = oc([steal('AWAY', 9)], 'HOME', 7);
  assert.equal(s.offPoss, 1);
  assert.equal(s.offPosPoss, 0);
  assert.equal(s.offCntPoss, 0);
  // Y para el rival (#9) cuenta como posesión defensiva sin fase.
  const d = oc([steal('AWAY', 9)], 'AWAY', 9);
  assert.equal(d.defPoss, 1);
  assert.equal(d.defPosPoss, 0);
});

check('un cambio traslada la atribución al jugador que entra', () => {
  const events = [
    shot('HOME', 7, ShotOutcome.GOAL, AttackPhase.POSITIONAL),  // con #7 en pista
    sub('HOME', 7, 11),                                         // sale #7, entra #11
    shot('HOME', 8, ShotOutcome.GOAL, AttackPhase.POSITIONAL),  // ahora con #11 en pista (no #7)
  ];
  const out = oc(events, 'HOME', 7);
  const inn = oc(events, 'HOME', 11);
  assert.equal(out.offPosPoss, 1);   // #7 solo la primera
  assert.equal(inn.offPosPoss, 1);   // #11 solo la segunda
  assert.equal(inn.offPosGoals, 1);
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
