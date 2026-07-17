import { EventType, ShotOrigin, ShotOutcome, MatchEvent } from '../../../src/ingestion/domain/match-event';
import { recomputeAggregates } from '../../../src/ingestion/application/recompute-aggregates';
import type { ResolvedRoster, ResolvedPlayer, ResolvedTeam } from '../../../src/ingestion/application/ports/repositories';
import type { MatchSummary, PlayerLine } from '../../../src/ingestion/application/read-models';

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

/** Traduce los eventos de la UI a eventos canónicos (match_event). Misma forma que el use case. */
export function toCanonicalEvents(
  events: UiEvent[], home: UiTeam, away: UiTeam, playedAt: string, matchId = 'live',
): MatchEvent[] {
  const gk: Record<Side, number | undefined> = { HOME: gkNumber(home), AWAY: gkNumber(away) };
  return [...events].sort((a, b) => a.t - b.t).map((e, seq) => {
    let payload: Record<string, unknown> = {};
    if (e.type === EventType.SHOT && e.outcome) {
      const opp: Side = e.side === 'HOME' ? 'AWAY' : 'HOME';
      payload = {
        outcome: e.outcome,
        origin: e.origin ?? undefined,
        zone: e.zone ?? undefined,
        isPenalty: false,
        goalkeeperId: e.outcome === ShotOutcome.SAVED ? `${opp}:${gk[opp]}` : null,
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
export { EventType, ShotOrigin, ShotOutcome } from '../../../src/ingestion/domain/match-event';
export { PLAY_SCORE_WEIGHTS, computePlayScore } from '../../../src/ingestion/application/play-score';
export type { MatchEvent } from '../../../src/ingestion/domain/match-event';
export type { MatchSummary, TeamSummary, PlayerLine, PlayScore, PlayScoreTerm, OriginCount, OriginBreakdown } from '../../../src/ingestion/application/read-models';
export type { NormalizedMatch } from '../../../src/ingestion/domain/normalized-match';
