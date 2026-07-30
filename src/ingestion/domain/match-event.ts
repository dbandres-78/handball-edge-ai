/**
 * Evento canónico tal y como se persiste en `match_event` (hypertable TimescaleDB).
 * TODO agregado del sistema se recalcula desde aquí. Es agnóstico a la fuente:
 * informe, etiquetado manual y CV producen exactamente esta forma.
 */
export enum EventType {
  SHOT = 'SHOT',                 // payload: ShotPayload
  TURNOVER = 'TURNOVER',         // pérdida
  STEAL = 'STEAL',               // recuperación
  FOUL = 'FOUL',                 // falta
  NEAR_PASS = 'NEAR_PASS',       // pase a 10 m en ataque (evento de EQUIPO, sin jugador); volumen
  TWO_MINUTES = 'TWO_MINUTES',   // exclusión 2'
  YELLOW_CARD = 'YELLOW_CARD',   // amonestación
  RED_CARD = 'RED_CARD',         // descalificación
  TIMEOUT = 'TIMEOUT',
  GOALKEEPER_CHANGE = 'GOALKEEPER_CHANGE',   // entra un portero; define quién para a partir de aquí
  SUBSTITUTION = 'SUBSTITUTION',   // cambio de jugador de campo: define quién está en pista (base del ±)
}

/**
 * Origen del lanzamiento: desde dónde tira el jugador. Es el input principal del xG
 * (la probabilidad de gol depende sobre todo de la posición de tiro).
 * Nomenclatura de puesto/distancia, que es como habla un entrenador de balonmano.
 */
export enum ShotOrigin {
  WING_LEFT = 'WING_LEFT',       // extremo izquierdo
  WING_RIGHT = 'WING_RIGHT',     // extremo derecho
  SIX_LEFT = 'SIX_LEFT',         // 6 m izquierda
  SIX_CENTER = 'SIX_CENTER',     // 6 m centro (pivote)
  SIX_RIGHT = 'SIX_RIGHT',       // 6 m derecha
  NINE_LEFT = 'NINE_LEFT',       // 9 m izquierda
  NINE_CENTER = 'NINE_CENTER',   // 9 m centro
  NINE_RIGHT = 'NINE_RIGHT',     // 9 m derecha
}

export enum ShotOutcome {
  GOAL = 'GOAL',
  SAVED = 'SAVED',     // parada del portero rival
  MISSED = 'MISSED',   // fuera / poste
  BLOCKED = 'BLOCKED', // blocaje defensivo
}

/**
 * Fase de ataque en la que se produce la acción terminal (tiro o pérdida). Es la base de la
 * eficiencia por fase y, en espejo, de la eficacia defensiva del rival (repliegue vs contraataque,
 * defensa vs ataque posicional). Se marca antes de anotar la acción.
 */
export enum AttackPhase {
  POSITIONAL = 'POSITIONAL',   // ataque posicional (contra defensa colocada)
  COUNTER = 'COUNTER',         // contraataque / transición
}

export interface ShotPayload {
  outcome: ShotOutcome;
  origin?: ShotOrigin;           // desde dónde se lanza  -> input de xG
  zone?: number;                 // 1..9 (zona de portería) -> input de xGOT (colocación)
  isPenalty?: boolean;
  phase?: AttackPhase;           // fase del ataque (posicional / contraataque) -> eficiencia por fase
  goalkeeperId?: string | null;  // portero rival implicado (si SAVED)
  blockerId?: string | null;     // defensor que bloca (si BLOCKED); sin él, el blocaje no se atribuye
}

/** Pérdida de balón. Cierra la posesión; lleva la fase para la eficiencia por fase. */
export interface TurnoverPayload {
  phase?: AttackPhase;
}

/**
 * Cambio de jugador de campo. Es lo que permite reconstruir quién está en pista en cada
 * instante y, por tanto, calcular el ± (plus-minus) individual. Sin estos eventos, la
 * reconstrucción asume que los titulares están en pista todo el partido (degradación honesta:
 * el ± de los titulares es correcto y el del banquillo queda a 0 hasta que se registren cambios).
 */
export interface SubstitutionPayload {
  playerOutId: string | null;    // jugador que sale de la pista
  playerInId: string | null;     // jugador que entra a la pista
}

export interface MatchEvent {
  matchId: string;
  seq: number;                   // orden estable dentro del partido
  ts: string;                    // ISO: playedAt + reloj de juego (dimensión temporal del hypertable)
  gameClockMs: number;           // ms desde el inicio del partido
  period: number;
  teamId: string;
  playerId: string | null;       // null en eventos de equipo (p.ej. TIMEOUT)
  type: EventType;
  payload: Record<string, unknown>;
}
