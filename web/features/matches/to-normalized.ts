import { EventType, ShotOutcome, UiTeam, UiEvent, Side } from '../../lib/handball/mapping';
import { fmt } from '../../lib/handball/format';

export interface ToNormalizedInput {
  matchId: string;
  competition?: string;
  matchday?: number;
  playedAt?: string;
  home: UiTeam;
  away: UiTeam;
  events: UiEvent[];
  sourceRef?: string;
}

const gkNum = (t: UiTeam) => (t.players.find((p) => p.gk) ?? t.players[0])?.number;

const toTeam = (t: UiTeam, side: Side) => ({
  side, name: t.name,
  players: t.players.map((p) => ({ number: p.number, name: p.name, position: p.gk ? 'GK' : null, starter: true })),
});

/**
 * Contrato de frontera (fuente MANUAL): el mismo que produce la ingesta de informes, así que
 * entra por el mismo caso de uso del backend. Única implementación: la usan la sala de vídeo,
 * la de directo y la copia a la nube — antes había tres copias divergiendo.
 */
export function toNormalizedMatch(input: ToNormalizedInput) {
  const { home, away, events } = input;
  return {
    source: 'MANUAL',
    sourceRef: input.sourceRef ?? input.matchId,
    competition: input.competition,
    matchday: input.matchday,
    playedAt: input.playedAt ?? new Date().toISOString(),
    teams: [toTeam(home, 'HOME'), toTeam(away, 'AWAY')],
    events: [...events].sort((a, b) => a.t - b.t).map((e) => ({
      clock: fmt(e.t),
      period: e.period,
      teamSide: e.side,
      playerNumber: e.playerNumber ?? undefined,
      type: e.type,
      shot: e.type === EventType.SHOT ? {
        outcome: e.outcome,
        origin: e.origin ?? undefined,
        zone: e.zone ?? undefined,
        goalkeeperNumber: e.outcome === ShotOutcome.SAVED ? gkNum(e.side === 'HOME' ? away : home) : undefined,
        blockerNumber: e.outcome === ShotOutcome.BLOCKED ? e.blockerNumber ?? undefined : undefined,
      } : undefined,
    })),
  };
}
