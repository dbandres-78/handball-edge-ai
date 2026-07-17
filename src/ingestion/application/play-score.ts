import { PlayScore, PlayScoreTerm, TermOrigin } from './read-models';

/**
 * Play Score = valor de las acciones de un jugador, término a término y auditable.
 *
 * DOS FAMILIAS DE PESOS, con estatus epistémico DISTINTO (no mezclar sin avisar):
 *
 *  1. AJUSTADOS ('fitted') — reconstruidos por regresión sobre los informes (Ola 3).
 *     R² ≈ 0.50 jugadores de campo, ≈ 0.63 porteros. Reproducen el score de referencia.
 *
 *  2. PRIORS ('prior') — términos DEFENSIVOS. El informe no exporta eventos defensivos, así que
 *     NO se han podido ajustar: son priors expertos, explícitos y calibrables. Se activan porque
 *     la plataforma ya captura estos eventos por sí misma (etiquetado en la sala de análisis).
 *     Se recalibrarán por regresión cuando haya volumen propio suficiente.
 *
 * Los pesos son inyectables por club (playscore_coefficients.json) sin desplegar.
 */
export interface PlayScoreWeights {
  goal: number;
  miss: number;
  turnover: number;
  save: number;
  steal: number;
  block: number;
  foul: number;
  twoMinutes: number;
  redCard: number;
}

export const PLAY_SCORE_WEIGHTS: PlayScoreWeights = {
  // --- ajustados por regresión ---
  goal: 1.8,
  miss: -1.0,        // tiro no convertido (parada, fuera, poste, blocaje)
  turnover: -0.55,
  save: 1.84,        // portero
  // --- priors defensivos (por calibrar) ---
  steal: 1.4,        // recuperación: quita posesión y suele abrir transición; por debajo de un gol
  block: 1.0,        // blocaje: anula el tiro, pero no garantiza recuperar la posesión
  foul: -0.1,        // falta ordinaria: táctica y muy frecuente en balonmano; apenas penaliza
  twoMinutes: -1.2,  // 2' de inferioridad ≈ coste esperado cercano a un gol
  redCard: -2.5,     // pierde al jugador el resto del partido + 2' sin sustituto
};

/** Qué peso es ajustado y cuál es prior. La UI y el desglose lo exponen. */
export const TERM_ORIGIN: Record<keyof PlayScoreWeights, TermOrigin> = {
  goal: 'fitted', miss: 'fitted', turnover: 'fitted', save: 'fitted',
  steal: 'prior', block: 'prior', foul: 'prior', twoMinutes: 'prior', redCard: 'prior',
};

export interface PlayScoreInput {
  goals: number;
  misses: number;
  turnovers: number;
  saves: number;
  steals?: number;
  blocks?: number;
  fouls?: number;
  twoMinutes?: number;
  redCards?: number;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Nota: la amonestación (amarilla) NO puntúa a propósito — es un aviso sin coste directo en juego.
 * El coste aparece si deriva en exclusión, y entonces ya lo recoge el término twoMinutes.
 */
export function computePlayScore(
  input: PlayScoreInput,
  weights: PlayScoreWeights = PLAY_SCORE_WEIGHTS,
): PlayScore {
  const rows: Array<[keyof PlayScoreWeights, number]> = [
    ['goal', input.goals],
    ['miss', input.misses],
    ['turnover', input.turnovers],
    ['save', input.saves],
    ['steal', input.steals ?? 0],
    ['block', input.blocks ?? 0],
    ['foul', input.fouls ?? 0],
    ['twoMinutes', input.twoMinutes ?? 0],
    ['redCard', input.redCards ?? 0],
  ];

  const breakdown: PlayScoreTerm[] = rows
    .filter(([, count]) => count !== 0)
    .map(([term, count]) => ({
      term,
      count,
      weight: weights[term],
      contribution: round2(count * weights[term]),
      origin: TERM_ORIGIN[term],
    }));

  const sum = (origin: TermOrigin) =>
    round2(breakdown.filter(t => t.origin === origin).reduce((s, t) => s + t.contribution, 0));

  const fittedTotal = sum('fitted');
  const priorTotal = sum('prior');

  return {
    total: round2(fittedTotal + priorTotal),
    fittedTotal,
    priorTotal,
    breakdown,
  };
}
