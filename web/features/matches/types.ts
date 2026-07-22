import type { UiTeam, UiEvent } from '../../lib/handball/mapping';

export type MatchStatus = 'new' | 'tagging' | 'extracted';

/**
 * Cómo se captura el partido. No cambia la estadística (misma capa canónica de eventos):
 * solo de dónde sale el reloj y qué sala se abre por defecto.
 *  - 'video' : etiquetado sobre vídeo, con cortes de clips.
 *  - 'live'  : anotación en directo con reloj corrido, sin vídeo ni clips.
 */
export type CaptureMode = 'video' | 'live';

/** Ficha para el listado de la biblioteca. */
export interface MatchListItem {
  matchId: string;
  competition?: string;
  matchday?: number;
  playedAt?: string;
  homeName: string;
  awayName: string;
  homeGoals: number;
  awayGoals: number;
  eventCount: number;
  status: MatchStatus;
  mode: CaptureMode;
}

/** Partido completo cargado en la sala de análisis. */
export interface LoadedMatch {
  matchId: string;
  competition?: string;
  matchday?: number;
  playedAt?: string;
  home: UiTeam;
  away: UiTeam;
  events: UiEvent[];
  status: MatchStatus;
  mode: CaptureMode;
  /** Ruta/clave del vídeo en el servidor (necesaria para el render). Null si aún no se ha subido. */
  videoRef?: string | null;
  /** Minutos por parte (solo relevante en directo, para el reloj). */
  periodMinutes?: number;
}
