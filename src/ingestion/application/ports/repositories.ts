import { MatchEvent } from '../../domain/match-event';
import { NormalizedMatch, TeamSide } from '../../domain/normalized-match';
import { MatchSummary, PlayerLine } from '../read-models';

/** Identidad interna resuelta de un jugador (get-or-create). */
export interface ResolvedPlayer {
  playerId: string;
  teamId: string;
  side: TeamSide;
  number: number;
  name: string;
  position: string;
  starter: boolean;
}

export interface ResolvedTeam {
  teamId: string;
  side: TeamSide;
  name: string;
}

export interface ResolvedRoster {
  matchId: string;
  teams: ResolvedTeam[];
  players: ResolvedPlayer[];
}

/**
 * Resuelve equipos y jugadores del NormalizedMatch a identidades internas, creando los
 * que no existan. Aquí vive el "cargar equipos nuevos o reutilizar los ya cargados".
 */
export interface EntityResolver {
  resolve(match: NormalizedMatch): Promise<ResolvedRoster>;
}

/** Persistencia de la capa canónica de eventos (`match_event`). */
export interface MatchEventRepository {
  /** Reemplaza atómicamente los eventos del partido (ingesta idempotente). */
  replaceForMatch(matchId: string, events: MatchEvent[]): Promise<void>;
  findByMatch(matchId: string): Promise<MatchEvent[]>;
}

/** Persistencia de los read-models (proyecciones recomputables). */
export interface ReadModelRepository {
  saveSummary(summary: MatchSummary): Promise<void>;
  savePlayers(players: PlayerLine[]): Promise<void>;
  getSummary(matchId: string): Promise<MatchSummary | null>;
  getPlayers(matchId: string): Promise<PlayerLine[]>;
}
