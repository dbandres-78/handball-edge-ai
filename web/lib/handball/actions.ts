import { EventType, ShotOutcome, TacticalContext, TurnoverReason } from '@handball/core';

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
  { key: 'PASE10', label: 'Pase a 10m',    type: EventType.NEAR_PASS, teamOnly: true, tone: 'neutral' },
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

/** Tiro o pérdida: las únicas acciones "terminales" que llevan fase y combinación táctica previa. */
export const isTerminalAction = (a: Pick<ActionDef, 'type'>): boolean =>
  a.type === EventType.SHOT || a.type === EventType.TURNOVER;

/**
 * Combinaciones tácticas previas a la acción terminal. Paso opcional y saltable en la anotación.
 * ACCION_INDIVIDUAL es una clasificación explícita más (no hubo combinación, resolvió solo),
 * distinta de "saltar" (que deja la jugada sin clasificar del todo).
 */
export const TACTICAL_CONTEXTS: TacticalContext[] = [
  TacticalContext.PERMUTA, TacticalContext.CRUCE, TacticalContext.DESDOBLAMIENTO, TacticalContext.CORTINA,
  TacticalContext.ACCION_INDIVIDUAL,
];

export const TACTICAL_CONTEXT_LABEL: Record<TacticalContext, string> = {
  [TacticalContext.PERMUTA]: 'Permuta',
  [TacticalContext.CRUCE]: 'Cruce',
  [TacticalContext.DESDOBLAMIENTO]: 'Desdoblamiento',
  [TacticalContext.CORTINA]: 'Cortina',
  [TacticalContext.ACCION_INDIVIDUAL]: 'Acción individual',
};

export const TACTICAL_CONTEXT_SHORT: Record<TacticalContext, string> = {
  [TacticalContext.PERMUTA]: 'permuta',
  [TacticalContext.CRUCE]: 'cruce',
  [TacticalContext.DESDOBLAMIENTO]: 'desdobl.',
  [TacticalContext.CORTINA]: 'cortina',
  [TacticalContext.ACCION_INDIVIDUAL]: 'individual',
};

/** Motivo de la pérdida. Paso opcional y saltable, igual que la combinación táctica previa. */
export const TURNOVER_REASONS: TurnoverReason[] = [
  TurnoverReason.FALTA_EN_ATAQUE, TurnoverReason.ROBO_DE_PASE, TurnoverReason.RECEPCION,
  TurnoverReason.PISANDO_AREA, TurnoverReason.DOBLES, TurnoverReason.PASOS,
];

export const TURNOVER_REASON_LABEL: Record<TurnoverReason, string> = {
  [TurnoverReason.FALTA_EN_ATAQUE]: 'Falta en ataque',
  [TurnoverReason.ROBO_DE_PASE]: 'Robo de pase',
  [TurnoverReason.RECEPCION]: 'Recepción',
  [TurnoverReason.PISANDO_AREA]: 'Pisando área',
  [TurnoverReason.DOBLES]: 'Dobles',
  [TurnoverReason.PASOS]: 'Pasos',
};

export const TERM_ES: Record<string, string> = {
  goal: 'Goles', miss: 'Tiros fallados', turnover: 'Pérdidas', save: 'Paradas',
  steal: 'Recuperaciones', block: 'Blocajes', foul: 'Faltas', assist: 'Asistencias',
  foulsDrawn: 'Faltas provocadas',
  nearPasses: 'Pases a 10m',
  twoMinutes: "Exclusiones 2′", redCard: 'Tarjeta roja', plusMinus: 'Diferencial ±',
};
