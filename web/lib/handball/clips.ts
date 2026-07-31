import { EventType, ShotOutcome, ShotOrigin, UiEvent, UiTeam, Side } from './mapping';
import { actionByType } from './actions';
import { fmt } from './format';

/**
 * Clips como PROYECCIÓN de los eventos (event-sourcing). Ya no se marca in/out a mano: cada
 * acción de juego anotada genera un clip candidato con una ventana [t − preRoll, t + postRoll].
 * El usuario selecciona cuáles renderizar. Función pura → testeable y con paridad garantizada.
 */

export interface ClipWindow { preRoll: number; postRoll: number }
export const DEFAULT_CLIP_WINDOW: ClipWindow = { preRoll: 8, postRoll: 4 };

/**
 * Tipos de evento que generan clip. Acciones de juego; se excluyen a propósito las
 * administrativas (cambio, cambio de portero, tiempo muerto) y el pase a 10 m (son muchos).
 */
export const CLIP_EVENT_TYPES: ReadonlySet<EventType> = new Set<EventType>([
  EventType.SHOT,        // gol, parada, fuera, blocado (incluye penalti)
  EventType.TURNOVER,    // pérdida
  EventType.STEAL,       // recuperación
  EventType.FOUL,        // falta
  EventType.TWO_MINUTES, // exclusión 2′
  EventType.YELLOW_CARD, // amarilla
  EventType.RED_CARD,    // roja
]);

export function isClipWorthy(e: UiEvent): boolean {
  return CLIP_EVENT_TYPES.has(e.type);
}

export interface DerivedClip {
  /** id del evento origen: clave estable del clip (borrar el evento borra el clip). */
  eventId: number;
  in: number; out: number;
  label: string;
  side: Side;
  type: EventType;
  outcome: ShotOutcome | null;
  origin: ShotOrigin | null;   // zona de lanzamiento (solo tiros); base del filtro por zona
  isGoal: boolean;
  isTurnover: boolean;
  /** true si tiene ajuste manual de in/out sobre la ventana por defecto. */
  edited: boolean;
}

/** Ajuste manual por clip (sobre la ventana global). */
export interface ClipOverride { in?: number; out?: number }

/**
 * Filtros del panel de clips en tres dimensiones:
 *  · Equipo: HOME / AWAY.
 *  · Acción: por resultado de tiro (GOAL/SAVED/MISSED/BLOCKED) o por tipo de acción.
 *  · Zona de tiro: cada origen de lanzamiento (solo aplica a tiros).
 * Dentro de una dimensión los filtros suman (OR); entre dimensiones se cruzan (AND).
 */
export type ClipTeamFilter = 'HOME' | 'AWAY';
export type ClipActionFilter =
  | 'GOAL' | 'SAVED' | 'MISSED' | 'BLOCKED'
  | 'TURNOVER' | 'STEAL' | 'FOUL' | 'TWO_MINUTES' | 'YELLOW' | 'RED';
export type ClipZoneFilter = `Z:${ShotOrigin}`;
export type ClipFilter = ClipTeamFilter | ClipActionFilter | ClipZoneFilter;

const TYPE_TO_ACTION: Partial<Record<EventType, ClipActionFilter>> = {
  [EventType.TURNOVER]: 'TURNOVER',
  [EventType.STEAL]: 'STEAL',
  [EventType.FOUL]: 'FOUL',
  [EventType.TWO_MINUTES]: 'TWO_MINUTES',
  [EventType.YELLOW_CARD]: 'YELLOW',
  [EventType.RED_CARD]: 'RED',
};

/** Clave de acción de un clip: para tiros es su resultado; para el resto, su tipo. */
export function clipActionKey(c: DerivedClip): ClipActionFilter | null {
  if (c.type === EventType.SHOT) return (c.outcome as ClipActionFilter) ?? null; // GOAL/SAVED/MISSED/BLOCKED
  return TYPE_TO_ACTION[c.type] ?? null;
}

const ACTION_KEYS = new Set<string>(['GOAL', 'SAVED', 'MISSED', 'BLOCKED', 'TURNOVER', 'STEAL', 'FOUL', 'TWO_MINUTES', 'YELLOW', 'RED']);

/** ¿Pasa el clip los filtros activos? OR dentro de cada dimensión, AND entre dimensiones. */
export function matchesFilters(c: DerivedClip, filters: Set<ClipFilter>): boolean {
  if (filters.size === 0) return true;
  let teamActive = false, actionActive = false, zoneActive = false;
  for (const f of filters) {
    if (f === 'HOME' || f === 'AWAY') teamActive = true;
    else if (f.startsWith('Z:')) zoneActive = true;
    else if (ACTION_KEYS.has(f)) actionActive = true;
  }

  const teamOk = !teamActive
    || (filters.has('HOME') && c.side === 'HOME')
    || (filters.has('AWAY') && c.side === 'AWAY');

  const ak = clipActionKey(c);
  const actionOk = !actionActive || (ak != null && filters.has(ak));

  const zoneOk = !zoneActive || (c.origin != null && filters.has(`Z:${c.origin}` as ClipFilter));

  return teamOk && actionOk && zoneOk;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function deriveClips(
  events: UiEvent[], home: UiTeam, away: UiTeam,
  duration: number, window: ClipWindow,
  overrides: Record<number, ClipOverride> = {},
): DerivedClip[] {
  const hi = duration > 0 ? duration : Number.POSITIVE_INFINITY;
  return events
    .filter(isClipWorthy)
    .slice()
    .sort((a, b) => a.t - b.t || a.id - b.id)
    .map((e) => {
      const ov = overrides[e.id] ?? {};
      const inPt = clamp(ov.in ?? e.t - window.preRoll, 0, hi);
      const outPt = clamp(ov.out ?? e.t + window.postRoll, 0, hi);
      const action = actionByType(e.type, e.outcome);
      const who = e.playerNumber != null ? `#${e.playerNumber}` : e.side === 'HOME' ? home.name : away.name;
      const label = `${action?.label ?? e.type} · ${who} · ${fmt(e.t)}`;
      return {
        eventId: e.id, in: inPt, out: outPt, label,
        side: e.side, type: e.type, outcome: e.outcome,
        origin: e.origin ?? null,
        isGoal: e.type === EventType.SHOT && e.outcome === ShotOutcome.GOAL,
        isTurnover: e.type === EventType.TURNOVER,
        edited: ov.in != null || ov.out != null,
      };
    });
}
