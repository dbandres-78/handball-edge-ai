import { EventType, ShotOrigin, ShotOutcome, MatchEvent, recomputeAggregates } from '@handball/core';
import type { ResolvedRoster, ResolvedPlayer, ResolvedTeam, MatchSummary, PlayerLine } from '@handball/core';

export type Side = 'HOME' | 'AWAY';

export interface UiPlayer { number: number; name: string; gk?: boolean }
export interface UiTeam { name: string; players: UiPlayer[] }
export interface UiEvent {
  id: number; t: number; period: number; side: Side;
  playerNumber: number | null; type: EventType; outcome: ShotOutcome | null; zone: number | null;
  /** Desde dónde se lanza (xG). Sin origen, el tiro no entra en los mapas de lanzamiento. */
  origin?: ShotOrigin | null;
  /** Defensor rival que bloca (si outcome = BLOCKED). Sin él, el blocaje no se atribuye a nadie. */
  blockerNumber?: number | null;
  /** Es lanzamiento de 7 metros (penalti). Sin esto, contamina el xG (un 7 m no es un tiro en juego). */
  isPenalty?: boolean;
}
export interface UiClip { id: number; in: number; out: number; label: string }
export interface MatchMeta { matchId?: string; competition?: string; matchday?: number; playedAt?: string }

const gkNumber = (team: UiTeam) => (team.players.find((p) => p.gk) ?? team.players[0])?.number;
const teamId = (s: Side) => (s === 'HOME' ? 'team:home' : 'team:away');

/**
 * Construye el roster resuelto (identidades sintéticas por dorsal). Espejo de lo que hará
 * EntityResolver en el backend; aquí sirve para calcular en vivo mientras se etiqueta.
 */
export function buildRoster(home: UiTeam, away: UiTeam, matchId = 'live'): ResolvedRoster {
  const teams: ResolvedTeam[] = [
    { teamId: teamId('HOME'), side: 'HOME', name: home.name },
    { teamId: teamId('AWAY'), side: 'AWAY', name: away.name },
  ];
  const players: ResolvedPlayer[] = [];
  ([['HOME', home], ['AWAY', away]] as const).forEach(([side, team]) => {
    for (const p of team.players) {
      players.push({
        playerId: `${side}:${p.number}`, teamId: teamId(side),
        side, number: p.number, name: p.name,
        position: p.gk ? 'GK' : 'NA', starter: true,
      });
    }
  });
  return { matchId, teams, players };
}

/**
 * Traduce los eventos de la UI a eventos canónicos (match_event). Misma forma que el use case.
 *
 * Portero en pista dinámico: se mantiene un `activeGk` por equipo que se actualiza con cada
 * GOALKEEPER_CHANGE. Si no hay ningún cambio, el portero en pista es el primer jugador con
 * gk: true (fallback). Para SHOT/SAVED, goalkeeperId = portero en pista del equipo RIVAL en
 * ese instante: es el portero que está parando, no el del equipo que lanza.
 */
export function toCanonicalEvents(
  events: UiEvent[], home: UiTeam, away: UiTeam, playedAt: string, matchId = 'live',
): MatchEvent[] {
  // Portero en pista inicial: primer jugador con gk de cada equipo.
  const activeGk: Record<Side, number | undefined> = {
    HOME: gkNumber(home),
    AWAY: gkNumber(away),
  };

  const sorted = [...events].sort((a, b) => a.t - b.t);
  return sorted.map((e, seq) => {
    // Actualizar portero en pista ANTES de procesar el evento:
    // un GOALKEEPER_CHANGE define quién para a partir de este momento.
    if (e.type === EventType.GOALKEEPER_CHANGE && e.playerNumber != null) {
      activeGk[e.side] = e.playerNumber;
    }

    let payload: Record<string, unknown> = {};
    if (e.type === EventType.SHOT && e.outcome) {
      const opp: Side = e.side === 'HOME' ? 'AWAY' : 'HOME';
      payload = {
        outcome: e.outcome,
        origin: e.origin ?? undefined,
        zone: e.zone ?? undefined,
        isPenalty: e.isPenalty ?? false,
        goalkeeperId: e.outcome === ShotOutcome.SAVED ? `${opp}:${activeGk[opp]}` : null,
        blockerId: e.outcome === ShotOutcome.BLOCKED && e.blockerNumber != null
          ? `${opp}:${e.blockerNumber}` : null,
      };
    }
    return {
      matchId, seq,
      ts: new Date(new Date(playedAt).getTime() + e.t * 1000).toISOString(),
      gameClockMs: Math.round(e.t * 1000),
      period: e.period,
      teamId: teamId(e.side),
      playerId: e.playerNumber != null ? `${e.side}:${e.playerNumber}` : null,
      type: e.type,
      payload,
    };
  });
}

export interface LiveStats { summary: MatchSummary; players: PlayerLine[] }

/** Estadística en vivo = mismo recompute canónico del backend, alimentado desde la UI. */
export function liveStats(meta: MatchMeta, events: UiEvent[], home: UiTeam, away: UiTeam): LiveStats {
  const playedAt = meta.playedAt ?? new Date().toISOString();
  const matchId = meta.matchId ?? 'live';
  const roster = buildRoster(home, away, matchId);
  const canonical = toCanonicalEvents(events, home, away, playedAt, matchId);
  return recomputeAggregates(
    { matchId, playedAt, competition: meta.competition, matchday: meta.matchday },
    canonical, roster,
  );
}

// Reexportes para que la UI importe todo lo "handball" desde un único sitio.
export { EventType, ShotOrigin, ShotOutcome } from '@handball/core';
export { PLAY_SCORE_WEIGHTS, computePlayScore } from '@handball/core';
export type { MatchEvent } from '@handball/core';
export type { MatchSummary, TeamSummary, PlayerLine, PlayScore, PlayScoreTerm, OriginCount, OriginBreakdown } from '@handball/core';
export type { NormalizedMatch } from '@handball/core';
