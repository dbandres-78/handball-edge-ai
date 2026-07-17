import { MatchEvent } from '../domain/match-event';
import { NormalizedMatch } from '../domain/normalized-match';
import {
  EntityResolver, MatchEventRepository, ReadModelRepository,
  ResolvedPlayer, ResolvedRoster, ResolvedTeam,
} from '../application/ports/repositories';
import { MatchSummary, PlayerLine } from '../application/read-models';

/**
 * Dobles en memoria para probar la rebanada sin Postgres/TimescaleDB.
 * Las implementaciones reales (repos sobre `match_event` hypertable y read-models) sustituyen
 * a estas SIN tocar el caso de uso: dependemos de los puertos, no de la infraestructura.
 */
export class InMemoryEntityResolver implements EntityResolver {
  // get-or-create determinista por nombre/dorsal (reutiliza si ya existe).
  private teams = new Map<string, string>();
  private players = new Map<string, string>();

  async resolve(match: NormalizedMatch): Promise<ResolvedRoster> {
    const matchId =
      `match:${match.competition ?? 'NA'}:J${match.matchday ?? 0}:${match.teams[0].name}-${match.teams[1].name}`;
    const teams: ResolvedTeam[] = [];
    const players: ResolvedPlayer[] = [];
    for (const t of match.teams) {
      const teamKey = t.name;
      if (!this.teams.has(teamKey)) this.teams.set(teamKey, `team:${this.teams.size + 1}`);
      const teamId = this.teams.get(teamKey)!;
      teams.push({ teamId, side: t.side, name: t.name });
      for (const p of t.players) {
        const pKey = `${teamKey}:${p.number}`;
        if (!this.players.has(pKey)) this.players.set(pKey, `player:${this.players.size + 1}`);
        players.push({
          playerId: this.players.get(pKey)!,
          teamId, side: t.side, number: p.number, name: p.name,
          position: p.position, starter: p.starter,
        });
      }
    }
    return { matchId, teams, players };
  }
}

export class InMemoryMatchEventRepository implements MatchEventRepository {
  private store = new Map<string, MatchEvent[]>();
  async replaceForMatch(matchId: string, events: MatchEvent[]): Promise<void> {
    this.store.set(matchId, events.map(e => ({ ...e })));
  }
  async findByMatch(matchId: string): Promise<MatchEvent[]> {
    return (this.store.get(matchId) ?? []).map(e => ({ ...e }));
  }
}

export class InMemoryReadModelRepository implements ReadModelRepository {
  private summaries = new Map<string, MatchSummary>();
  private playerLines = new Map<string, PlayerLine[]>();
  async saveSummary(summary: MatchSummary): Promise<void> {
    this.summaries.set(summary.matchId, summary);
  }
  async savePlayers(players: PlayerLine[]): Promise<void> {
    if (players[0]) this.playerLines.set(players[0].matchId, players);
  }
  async getSummary(matchId: string): Promise<MatchSummary | null> {
    return this.summaries.get(matchId) ?? null;
  }
  async getPlayers(matchId: string): Promise<PlayerLine[]> {
    return this.playerLines.get(matchId) ?? [];
  }
}
