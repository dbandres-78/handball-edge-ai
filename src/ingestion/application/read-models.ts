import { TeamSide } from '../domain/normalized-match';
import { ShotOrigin } from '../domain/match-event';

/**
 * Conteo por zona de lanzamiento. Es la materia prima del xG: sin saber desde dónde se tira
 * y cuántos de esos tiros acaban en gol, no hay modelo de gol esperado que calcular.
 * `onTarget` (gol + parada) es lo que necesita el xGOT, que solo mira tiros a puerta.
 */
export interface OriginCount {
  shots: number;
  goals: number;
  onTarget: number;      // gol o parada: el tiro iba a portería
  saved: number;
  missed: number;
  blocked: number;
}

export type OriginBreakdown = Partial<Record<ShotOrigin, OriginCount>>;

/**
 * 'fitted' = peso reconstruido por regresión sobre los informes.
 * 'prior'  = peso experto aún sin calibrar (términos defensivos).
 */
export type TermOrigin = 'fitted' | 'prior';

export interface PlayScoreTerm {
  term: string;
  count: number;
  weight: number;
  contribution: number;
  origin: TermOrigin;
}

export interface PlayScore {
  total: number;
  fittedTotal: number;          // parte del score con pesos ajustados por regresión
  priorTotal: number;           // parte del score con priors defensivos (por calibrar)
  breakdown: PlayScoreTerm[];   // desglose auditable, término a término
}

export interface PlayerLine {
  matchId: string;
  playerId: string;
  teamId: string;
  side: TeamSide;
  number: number;
  name: string;
  position: string;
  goals: number;
  shots: number;
  misses: number;
  saves: number;                // portero
  xg: number;                   // expected goals: suma por zona de lanzamiento
  xgot: number;                 // expected goals on target: xG ajustado por colocación
  byOrigin: OriginBreakdown;    // tiros/goles por zona de lanzamiento (base del xG)
  turnovers: number;
  steals: number;
  blocks: number;               // blocajes defensivos atribuidos (requiere blockerId en el tiro)
  fouls: number;
  twoMinutes: number;
  yellowCards: number;
  redCards: number;
  playScore: PlayScore;
}

export interface TeamSummary {
  teamId: string;
  side: TeamSide;
  name: string;
  goals: number;
  shots: number;
  saves: number;
  savePct: number | null;       // saves / (saves + goles encajados)
  xg: number;                   // expected goals del equipo (suma por zona de lanzamiento)
  xgot: number;                 // expected goals on target del equipo
  byOrigin: OriginBreakdown;    // tiros/goles por zona de lanzamiento (base del xG)
  goalZones: Partial<Record<number, number>>;   // goles por zona de portería 1..9 (base del xGOT)
  turnovers: number;
  steals: number;
  blocks: number;
  twoMinutes: number;
  yellowCards: number;
  redCards: number;
  timeouts: number;
}

export interface MatchSummary {
  matchId: string;
  playedAt: string;
  competition?: string;
  matchday?: number;
  home: TeamSummary;
  away: TeamSummary;
}
