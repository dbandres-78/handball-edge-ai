import { PlayScoreWeights, PLAY_SCORE_WEIGHTS } from './play-score';

const TERMS: Array<keyof PlayScoreWeights> = [
  'goal', 'miss', 'turnover', 'save', 'steal', 'block', 'foul', 'twoMinutes', 'redCard', 'plusMinus',
];

export interface CoefficientsFile {
  version?: string;
  club?: string;
  weights: Record<string, unknown>;
}

/**
 * Carga los pesos de un fichero de coeficientes (playscore_coefficients.json), permitiendo
 * inyectarlos por club sin desplegar. Falla ruidosamente si falta un término o no es un número:
 * un Play Score con pesos silenciosamente incompletos sería peor que un error.
 */
export function parseWeights(raw: unknown): PlayScoreWeights {
  const file = raw as CoefficientsFile | null;
  if (!file || typeof file !== 'object' || !file.weights) {
    throw new Error('playscore_coefficients: falta el objeto "weights"');
  }
  const out = {} as PlayScoreWeights;
  for (const term of TERMS) {
    const value = file.weights[term];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`playscore_coefficients: el peso "${term}" falta o no es un número`);
    }
    out[term] = value;
  }
  return out;
}

/** Pesos por defecto si no hay fichero de club. */
export const defaultWeights = (): PlayScoreWeights => ({ ...PLAY_SCORE_WEIGHTS });
