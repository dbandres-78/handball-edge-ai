import { EventType, ShotOutcome } from '../domain/match-event';
import {
  IngestionSource, NormalizedEvent, NormalizedMatch, NormalizedPlayer,
  NormalizedTeam, TeamSide,
} from '../domain/normalized-match';
import { normalizePosition } from '../domain/position';
import { IngestionAdapter } from '../application/ports/ingestion.adapter';

/* ------------------------------------------------------------------ *
 * Forma CRUDA del informe Handball.AI (subconjunto usado por la rebanada).
 * TODO lo específico de este formato vive AQUÍ y no cruza a NormalizedMatch.
 * ------------------------------------------------------------------ */
export interface RawReport {
  meta: {
    competicion?: string; jornada?: number; fecha: string;
    local: string; visitante: string; informeId?: string;
  };
  plantillas: { local: RawPlayer[]; visitante: RawPlayer[] };
  cronograma: RawEvent[];
}
interface RawPlayer { dorsal: number; nombre: string; puesto: string; titular: boolean; id?: string }
interface RawEvent {
  min: string; parte: number; equipo: 'local' | 'visitante'; dorsal?: number;
  accion: string; zona?: number; porteroRival?: number; penalti?: boolean;
}

/** Verbos del informe (ES) -> evento canónico. Peculiaridad de formato, contenida aquí. */
const ACTION_MAP: Readonly<Record<string, { type: EventType; outcome?: ShotOutcome }>> = {
  'GOL': { type: EventType.SHOT, outcome: ShotOutcome.GOAL },
  'TIRO PARADO': { type: EventType.SHOT, outcome: ShotOutcome.SAVED },
  'TIRO FUERA': { type: EventType.SHOT, outcome: ShotOutcome.MISSED },
  'TIRO BLOCADO': { type: EventType.SHOT, outcome: ShotOutcome.BLOCKED },
  'PERDIDA': { type: EventType.TURNOVER },
  'RECUPERACION': { type: EventType.STEAL },
  'FALTA': { type: EventType.FOUL },
  'EXCLUSION': { type: EventType.TWO_MINUTES },
  'AMARILLA': { type: EventType.YELLOW_CARD },
  'ROJA': { type: EventType.RED_CARD },
  'TIEMPO MUERTO': { type: EventType.TIMEOUT },
};

/** Normaliza acentos/mayúsculas para casar el verbo del informe. */
const norm = (s: string): string =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();

/** Alias de patrocinador -> nombre canónico del club (peculiaridad de formato). */
const SPONSOR_ALIASES: Readonly<Record<string, string>> = {
  'BM EJEMPLO CAJA RURAL': 'BM Ejemplo',
};
const canonicalTeamName = (raw: string): string => SPONSOR_ALIASES[norm(raw)] ?? raw.trim();

export class ReportImportAdapter implements IngestionAdapter<RawReport> {
  readonly source = IngestionSource.REPORT;

  toNormalizedMatch(raw: RawReport): NormalizedMatch {
    const home = this.toTeam('HOME', raw.meta.local, raw.plantillas.local);
    const away = this.toTeam('AWAY', raw.meta.visitante, raw.plantillas.visitante);
    const events = raw.cronograma.map((e, i) => this.toEvent(e, i));

    return {
      source: IngestionSource.REPORT,
      sourceRef: raw.meta.informeId,
      competition: raw.meta.competicion,
      matchday: raw.meta.jornada,
      playedAt: new Date(raw.meta.fecha).toISOString(),
      teams: [home, away],
      events,
    };
  }

  private toTeam(side: TeamSide, rawName: string, roster: RawPlayer[]): NormalizedTeam {
    const players: NormalizedPlayer[] = roster.map(p => ({
      number: p.dorsal,
      name: p.nombre,
      position: normalizePosition(p.puesto),
      starter: p.titular,
      externalId: p.id,
    }));
    return { side, name: canonicalTeamName(rawName), players };
  }

  private toEvent(e: RawEvent, index: number): NormalizedEvent {
    const mapped = ACTION_MAP[norm(e.accion)];
    if (!mapped) {
      throw new Error(`Acción de informe no soportada (línea ${index + 1}): "${e.accion}".`);
    }
    const teamSide: TeamSide = e.equipo === 'local' ? 'HOME' : 'AWAY';
    const base: NormalizedEvent = {
      clock: e.min,
      period: e.parte,
      teamSide,
      playerNumber: e.dorsal,
      type: mapped.type,
    };
    if (mapped.type === EventType.SHOT) {
      base.shot = {
        outcome: mapped.outcome!,
        zone: e.zona,
        isPenalty: e.penalti ?? false,
        goalkeeperNumber: e.porteroRival,
      };
    }
    return base;
  }
}
