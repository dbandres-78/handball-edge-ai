import { EventType, ShotOutcome } from '@handball/core';

export type Tone = 'goal' | 'save' | 'miss' | 'neg' | 'pos' | 'warn' | 'neutral';

export interface ActionDef {
  key: string;
  label: string;
  type: EventType;
  outcome?: ShotOutcome;
  shot?: boolean;
  teamOnly?: boolean;
  tone: Tone;
}

/** Botones de anotación. La etiqueta/color es presentación; type/outcome es dominio. */
export const ACTIONS: ActionDef[] = [
  { key: 'GOL',    label: 'Gol',           type: EventType.SHOT, outcome: ShotOutcome.GOAL,    shot: true, tone: 'goal' },
  { key: 'PARADA', label: 'Tiro parado',   type: EventType.SHOT, outcome: ShotOutcome.SAVED,   shot: true, tone: 'save' },
  { key: 'FUERA',  label: 'Tiro fuera',    type: EventType.SHOT, outcome: ShotOutcome.MISSED,  shot: true, tone: 'miss' },
  { key: 'BLOC',   label: 'Blocado',       type: EventType.SHOT, outcome: ShotOutcome.BLOCKED, shot: true, tone: 'miss' },
  { key: 'PERD',   label: 'Pérdida',       type: EventType.TURNOVER,     tone: 'neg' },
  { key: 'RECUP',  label: 'Recuperación',  type: EventType.STEAL,        tone: 'pos' },
  { key: 'FALTA',  label: 'Falta',         type: EventType.FOUL,         tone: 'neutral' },
  { key: 'EXCL',   label: "Exclusión 2′",  type: EventType.TWO_MINUTES,  tone: 'warn' },
  { key: 'AMAR',   label: 'Amarilla',      type: EventType.YELLOW_CARD,  tone: 'warn' },
  { key: 'ROJA',   label: 'Roja',          type: EventType.RED_CARD,     tone: 'neg' },
  { key: 'TIME',   label: 'Tiempo muerto', type: EventType.TIMEOUT, teamOnly: true, tone: 'neutral' },
  { key: 'GK',     label: 'Cambio portero', type: EventType.GOALKEEPER_CHANGE, tone: 'neutral' },
];

export const actionByType = (type: EventType, outcome: ShotOutcome | null): ActionDef | undefined => {
  if (type === EventType.SHOT) return ACTIONS.find((a) => a.type === EventType.SHOT && a.outcome === outcome);
  return ACTIONS.find((a) => a.type === type);
};

export const TERM_ES: Record<string, string> = {
  goal: 'Goles', miss: 'Tiros fallados', turnover: 'Pérdidas', save: 'Paradas',
  steal: 'Recuperaciones', block: 'Blocajes', foul: 'Faltas',
  twoMinutes: "Exclusiones 2′", redCard: 'Tarjeta roja', plusMinus: 'Diferencial ±',
};
