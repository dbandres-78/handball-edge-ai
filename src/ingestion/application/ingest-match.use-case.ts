import { EventType, MatchEvent, ShotOutcome, ShotPayload } from '../domain/match-event';
import { NormalizedEvent, NormalizedMatch, TeamSide } from '../domain/normalized-match';
import { recomputeAggregates } from './recompute-aggregates';
import { EntityResolver, MatchEventRepository, ReadModelRepository } from './ports/repositories';

export interface IngestResult {
  matchId: string;
  eventCount: number;
}

const clockToMs = (clock: string): number => {
  const [mm, ss] = clock.split(':').map(Number);
  return ((mm ?? 0) * 60 + (ss ?? 0)) * 1000;
};

/**
 * Orquesta la rebanada vertical de ingesta:
 *   NormalizedMatch -> resolución de identidades -> eventos canónicos ->
 *   persistir en match_event -> recomputar agregados -> persistir read-models.
 *
 * Nótese que NO conoce ningún formato de origen: sólo el contrato NormalizedMatch.
 */
export class IngestMatchUseCase {
  constructor(
    private readonly resolver: EntityResolver,
    private readonly events: MatchEventRepository,
    private readonly readModels: ReadModelRepository,
  ) {}

  async execute(match: NormalizedMatch): Promise<IngestResult> {
    const roster = await this.resolver.resolve(match);

    const teamIdBySide = new Map<TeamSide, string>(roster.teams.map(t => [t.side, t.teamId]));
    const playerIdByKey = new Map<string, string>(
      roster.players.map(p => [`${p.side}:${p.number}`, p.playerId]),
    );
    const playerId = (side: TeamSide, number?: number): string | null =>
      number == null ? null : (playerIdByKey.get(`${side}:${number}`) ?? null);

    const matchEvents: MatchEvent[] = match.events.map((ev, i) =>
      this.toCanonical(match, roster.matchId, i, ev, teamIdBySide, playerId),
    );

    await this.events.replaceForMatch(roster.matchId, matchEvents);

    const { summary, players } = recomputeAggregates(
      { matchId: roster.matchId, playedAt: match.playedAt, competition: match.competition, matchday: match.matchday },
      matchEvents,
      roster,
    );
    await this.readModels.saveSummary(summary);
    await this.readModels.savePlayers(players);

    return { matchId: roster.matchId, eventCount: matchEvents.length };
  }

  private toCanonical(
    match: NormalizedMatch,
    matchId: string,
    seq: number,
    ev: NormalizedEvent,
    teamIdBySide: Map<TeamSide, string>,
    playerId: (side: TeamSide, number?: number) => string | null,
  ): MatchEvent {
    const gameClockMs = clockToMs(ev.clock);
    const ts = new Date(new Date(match.playedAt).getTime() + gameClockMs).toISOString();
    const teamId = teamIdBySide.get(ev.teamSide)!;

    let payload: Record<string, unknown> = {};
    if (ev.type === EventType.SHOT && ev.shot) {
      const opponentSide: TeamSide = ev.teamSide === 'HOME' ? 'AWAY' : 'HOME';
      const goalkeeperId =
        ev.shot.outcome === ShotOutcome.SAVED
          ? playerId(opponentSide, ev.shot.goalkeeperNumber)
          : null;
      const blockerId =
        ev.shot.outcome === ShotOutcome.BLOCKED && ev.shot.blockerNumber != null
          ? playerId(opponentSide, ev.shot.blockerNumber)
          : null;
      const shotPayload: ShotPayload = {
        outcome: ev.shot.outcome,
        origin: ev.shot.origin,
        zone: ev.shot.zone,
        isPenalty: ev.shot.isPenalty ?? false,
        goalkeeperId,
        blockerId,
      };
      payload = { ...shotPayload };
    }

    return {
      matchId,
      seq,
      ts,
      gameClockMs,
      period: ev.period,
      teamId,
      playerId: playerId(ev.teamSide, ev.playerNumber),
      type: ev.type,
      payload,
    };
  }
}
