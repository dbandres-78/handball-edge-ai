import type { NormalizedMatch, NormalizedEvent } from '@handball/core';
import { EventType } from '@handball/core';
import type { UiEvent, UiTeam } from './mapping';
import type { CreateMatchInput } from '@/features/matches/repository';

/**
 * Puente de ingesta: NormalizedMatch (dominio del core) → tipos de la web.
 *
 * El core produce un NormalizedMatch con eventos en reloj "MM:SS". La web trabaja con
 * UiEvent (segundos absolutos) y UiTeam. Esta función traduce sin perder nada, de modo
 * que un informe importado se comporta igual que un partido etiquetado a mano.
 */

/** "MM:SS" o "M:SS" → segundos. Un reloj mal formado cae a 0 (no rompe la ingesta). */
export function clockToSeconds(clock: string): number {
  const m = clock.match(/^(\d+):(\d{1,2})$/);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Convierte un equipo normalizado al UiTeam de la web (marca porteros por posición). */
function toUiTeam(nm: NormalizedMatch, side: 'HOME' | 'AWAY'): UiTeam {
  const team = nm.teams.find((t) => t.side === side)!;
  return {
    name: team.name,
    players: team.players.map((p) => ({
      number: p.number,
      name: p.name,
      // GK es la posición de portero en el enum canónico.
      gk: p.position === 'GK',
    })),
  };
}

/** Convierte los eventos normalizados en UiEvent, preservando tiro, zona, penalti y blocaje. */
function toUiEvents(events: NormalizedEvent[]): UiEvent[] {
  return events.map((e, i) => ({
    id: i,
    t: clockToSeconds(e.clock),
    period: e.period,
    side: e.teamSide,
    playerNumber: e.playerNumber ?? null,
    type: e.type,
    outcome: e.shot?.outcome ?? null,
    zone: e.shot?.zone ?? null,
    origin: e.shot?.origin ?? null,
    blockerNumber: e.shot?.blockerNumber ?? null,
    isPenalty: e.shot?.isPenalty ?? undefined,
  }));
}

export interface IngestBridgeResult {
  create: CreateMatchInput;
  events: UiEvent[];
}

/**
 * Prepara los datos para persistir un informe importado: el input de creación del partido
 * y sus eventos. El endpoint crea el partido y luego guarda los eventos.
 */
export function normalizedToWeb(nm: NormalizedMatch): IngestBridgeResult {
  const home = toUiTeam(nm, 'HOME');
  const away = toUiTeam(nm, 'AWAY');
  return {
    create: {
      competition: nm.competition,
      matchday: nm.matchday,
      playedAt: nm.playedAt,
      home: { name: home.name, players: home.players },
      away: { name: away.name, players: away.players },
      // Un informe importado es material de vídeo/acta, no captura en directo.
      mode: 'video',
    },
    events: toUiEvents(nm.events),
  };
}
