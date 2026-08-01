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
  plusMinus: number;            // diferencial de goles del equipo mientras el jugador está en pista (±)
  minutesPlayed: number;        // minutos en pista (integral desde titulares + cambios; fin = última acción)
  onCourt: OnCourtSplits;       // posesiones/goles atribuidos por estar en pista (on/off por fase)
  playScore: PlayScore;
}

/**
 * Posesiones y goles atribuidos a un jugador por estar EN PISTA. Base de la eficacia on/off por
 * fase de la ficha: ofensiva=ataque posicional, contra=contraataque, defensiva=defensa posicional,
 * repliegue=defensa vs contraataque rival. Las posesiones cerradas por robo entran en offPoss/defPoss
 * (totales) pero no en el desglose por fase.
 */
export interface OnCourtSplits {
  offPoss: number; defPoss: number;
  offPosPoss: number; offPosGoals: number;
  offCntPoss: number; offCntGoals: number;
  defPosPoss: number; defPosGoals: number;
  defCntPoss: number; defCntGoals: number;
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
  nearPasses: number;           // pases a 10 m en ataque (volumen); ataque cercano / defensa permisiva
  /** Posesiones del equipo: cada tiro, pérdida o robo del rival cierra una (por cambio real de balón). */
  possessions: number;
  /** Posesiones cuya acción terminal (tiro/pérdida) llevaba fase marcada. Las cerradas por robo no tienen fase. */
  possessionsByPhase: { positional: number; counter: number };
  /** Goles del equipo por fase (base de la eficiencia por fase). */
  goalsByPhase: { positional: number; counter: number };
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
