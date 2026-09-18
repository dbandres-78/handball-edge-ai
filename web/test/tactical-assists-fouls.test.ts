import assert from 'node:assert/strict';
import {
  EventType, ShotOutcome, TacticalContext, TurnoverReason, recomputeAggregates,
} from '@handball/core';
import type { MatchEvent, ResolvedRoster } from '@handball/core';

/**
 * Cuatro ampliaciones pedidas para nutrir los informes visuales (18/09/2026):
 *  - Asistencias: `assisterId` en un tiro con GOAL, del mismo equipo que anota.
 *  - Faltas provocadas/cometidas: `drawnById` en FOUL, del equipo RIVAL a quien la comete.
 *  - Sistema de partido: agregación por `tacticalContext` (permuta/cruce/desdoblamiento/
 *    cortina/acción individual), tanto en tiros como en pérdidas, a nivel de equipo.
 *  - Motivo de la pérdida: agregación por `reason` en TURNOVER, a nivel de equipo.
 */

const roster: ResolvedRoster = {
  matchId: 'taf',
  teams: [
    { teamId: 'H', side: 'HOME', name: 'Local' },
    { teamId: 'A', side: 'AWAY', name: 'Visitante' },
  ],
  players: [
    { playerId: 'H:7', teamId: 'H', side: 'HOME', number: 7, name: 'Extremo H', position: 'NA', starter: true },
    { playerId: 'H:9', teamId: 'H', side: 'HOME', number: 9, name: 'Pivote H', position: 'NA', starter: true },
    { playerId: 'H:4', teamId: 'H', side: 'HOME', number: 4, name: 'Lateral H', position: 'NA', starter: true },
    { playerId: 'A:5', teamId: 'A', side: 'AWAY', number: 5, name: 'Lateral A', position: 'NA', starter: true },
    { playerId: 'A:3', teamId: 'A', side: 'AWAY', number: 3, name: 'Central A', position: 'NA', starter: true },
  ],
};

let seq = 0;
const ev = (teamId: string, playerId: string | null, type: EventType, payload: Record<string, unknown> = {}): MatchEvent => ({
  matchId: 'taf', seq: seq++, ts: new Date(Date.now() + seq * 1000).toISOString(),
  gameClockMs: seq * 1000, period: 1, teamId, playerId, type, payload,
});

const meta = { matchId: 'taf', playedAt: '2026-09-18T10:00:00.000Z' };

let pass = 0, fail = 0;
const check = (name: string, fn: () => void) => {
  try { fn(); console.log(`  ✓ ${name}`); pass++; }
  catch (err) { console.log(`  ✗ ${name}`); console.log(`      ${(err as Error).message}`); fail++; }
};

function main() {
  check('la asistencia se atribuye al compañero cuyo pase precede el gol', () => {
    const events = [
      ev('H', 'H:7', EventType.SHOT, { outcome: ShotOutcome.GOAL, assisterId: 'H:9' }),
    ];
    const { players } = recomputeAggregates(meta, events, roster);
    const scorer = players.find(p => p.playerId === 'H:7')!;
    const assister = players.find(p => p.playerId === 'H:9')!;
    assert.equal(scorer.goals, 1);
    assert.equal(assister.assists, 1);
    assert.equal(scorer.assists, 0);
  });

  check('una asistencia del equipo RIVAL al goleador se ignora (dato inconsistente)', () => {
    const events = [
      ev('H', 'H:7', EventType.SHOT, { outcome: ShotOutcome.GOAL, assisterId: 'A:5' }),
    ];
    const { players } = recomputeAggregates(meta, events, roster);
    assert.equal(players.find(p => p.playerId === 'A:5')!.assists, 0);
  });

  check('un fallo o parada no atribuye asistencia aunque lleve assisterId', () => {
    const events = [
      ev('H', 'H:7', EventType.SHOT, { outcome: ShotOutcome.SAVED, assisterId: 'H:9' }),
    ];
    const { players } = recomputeAggregates(meta, events, roster);
    assert.equal(players.find(p => p.playerId === 'H:9')!.assists, 0);
  });

  check('la falta cuenta como cometida por quien la hace y provocada por quien la sufre', () => {
    const events = [
      ev('H', 'H:4', EventType.FOUL, { drawnById: 'A:5' }),
    ];
    const { players } = recomputeAggregates(meta, events, roster);
    assert.equal(players.find(p => p.playerId === 'H:4')!.fouls, 1);
    assert.equal(players.find(p => p.playerId === 'H:4')!.foulsDrawn, 0);
    assert.equal(players.find(p => p.playerId === 'A:5')!.foulsDrawn, 1);
    assert.equal(players.find(p => p.playerId === 'A:5')!.fouls, 0);
  });

  check('una falta sin drawnById cuenta solo como cometida (paso opcional saltado)', () => {
    const events = [ev('H', 'H:4', EventType.FOUL, {})];
    const { players } = recomputeAggregates(meta, events, roster);
    assert.equal(players.find(p => p.playerId === 'H:4')!.fouls, 1);
    assert.equal(players.every(p => p.foulsDrawn === 0), true);
  });

  check('drawnById del MISMO equipo que comete se ignora (dato inconsistente)', () => {
    const events = [ev('H', 'H:4', EventType.FOUL, { drawnById: 'H:9' })];
    const { players } = recomputeAggregates(meta, events, roster);
    assert.equal(players.find(p => p.playerId === 'H:9')!.foulsDrawn, 0);
  });

  check('Sistema de partido: tiros y pérdidas se agregan por combinación táctica previa', () => {
    const events = [
      ev('H', 'H:7', EventType.SHOT, { outcome: ShotOutcome.GOAL, tacticalContext: TacticalContext.PERMUTA }),
      ev('H', 'H:9', EventType.SHOT, { outcome: ShotOutcome.SAVED, tacticalContext: TacticalContext.PERMUTA }),
      ev('H', 'H:4', EventType.TURNOVER, { tacticalContext: TacticalContext.PERMUTA }),
      ev('H', 'H:7', EventType.SHOT, { outcome: ShotOutcome.GOAL, isPenalty: true, tacticalContext: TacticalContext.ACCION_INDIVIDUAL }),
      ev('H', 'H:9', EventType.SHOT, { outcome: ShotOutcome.MISSED }),   // sin clasificar: no entra
    ];
    const { summary } = recomputeAggregates(meta, events, roster);
    const tc = summary.home.tacticalContext;
    assert.deepEqual(tc[TacticalContext.PERMUTA], {
      shots: 2, goals: 1, onTarget: 2, saved: 1, missed: 0, blocked: 0, turnovers: 1, penalties: 0,
    });
    assert.deepEqual(tc[TacticalContext.ACCION_INDIVIDUAL], {
      shots: 1, goals: 1, onTarget: 1, saved: 0, missed: 0, blocked: 0, turnovers: 0, penalties: 1,
    });
    assert.equal(tc[TacticalContext.CRUCE], undefined);
  });

  check('motivo de la pérdida: se agrega por equipo, sin motivo no entra en el desglose', () => {
    const events = [
      ev('H', 'H:4', EventType.TURNOVER, { reason: TurnoverReason.PASOS }),
      ev('H', 'H:9', EventType.TURNOVER, { reason: TurnoverReason.PASOS }),
      ev('H', 'H:7', EventType.TURNOVER, { reason: TurnoverReason.ROBO_DE_PASE }),
      ev('H', 'H:4', EventType.TURNOVER, {}),   // sin motivo: no entra en el desglose
    ];
    const { summary } = recomputeAggregates(meta, events, roster);
    const tr = summary.home.turnoversByReason;
    assert.equal(tr[TurnoverReason.PASOS], 2);
    assert.equal(tr[TurnoverReason.ROBO_DE_PASE], 1);
    assert.equal(tr[TurnoverReason.DOBLES], undefined);
    // 4 pérdidas en total (con motivo o sin él) aunque solo 3 entren en el desglose.
    assert.equal(summary.home.turnovers, 4);
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main();
