import { Position } from './position';
import { EventType, ShotOrigin, ShotOutcome } from './match-event';

export enum IngestionSource {
  REPORT = 'REPORT',            // informe post-partido (Handball.AI u otro)
  MANUAL = 'MANUAL',            // etiquetado en directo
  COMPUTER_VISION = 'CV',
}

export type TeamSide = 'HOME' | 'AWAY';

/**
 * Contrato de frontera source-agnostic. Es el ÚNICO artefacto que un IngestionAdapter
 * debe producir. Referencia a los jugadores por dorsal/nombre de la fuente; la resolución
 * a identidades internas (get-or-create de equipos y jugadores) ocurre en el caso de uso.
 */
export interface NormalizedMatch {
  source: IngestionSource;
  sourceRef?: string;           // id del informe/vídeo de origen (trazabilidad)
  competition?: string;
  matchday?: number;
  playedAt: string;             // ISO 8601
  teams: [NormalizedTeam, NormalizedTeam];
  events: NormalizedEvent[];
}

export interface NormalizedTeam {
  side: TeamSide;
  name: string;                 // nombre canónico (alias de patrocinador ya resuelto)
  externalId?: string;
  players: NormalizedPlayer[];
}

export interface NormalizedPlayer {
  number: number;               // dorsal
  name: string;
  position: Position;
  starter: boolean;
  externalId?: string;
}

export interface NormalizedShot {
  outcome: ShotOutcome;
  origin?: ShotOrigin;          // zona de lanzamiento (xG)
  zone?: number;
  isPenalty?: boolean;
  goalkeeperNumber?: number;    // dorsal del portero rival (si SAVED); se resuelve a id en el caso de uso
  blockerNumber?: number;       // dorsal del defensor rival que bloca (si BLOCKED); ídem
}

export interface NormalizedEvent {
  clock: string;                // "MM:SS" del reloj de juego
  period: number;
  teamSide: TeamSide;
  playerNumber?: number;        // ausente en eventos de equipo
  type: EventType;
  shot?: NormalizedShot;        // presente sii type === SHOT
}
