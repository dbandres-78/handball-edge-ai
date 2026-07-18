import { ShotOrigin } from '../domain/match-event';

/**
 * xG / xGOT de referencia para balonmano.
 *
 * DOS SEÑALES SEPARADAS (decisión de diseño):
 *
 *  1. xG  — depende SOLO de la zona de LANZAMIENTO (desde dónde tira el jugador).
 *           Responde: "¿qué probabilidad de gol tiene un tiro desde aquí?"
 *           Se calcula ANTES de saber si el tiro va a puerta.
 *
 *  2. xGOT — añade la COLOCACIÓN (a qué zona de portería va el tiro).
 *            Solo tiene sentido si el tiro va a puerta (gol o parada; no fuera/poste).
 *            Responde: "dado que va a puerta y a esta zona, ¿qué probabilidad de gol?"
 *            xGOT = xG * (placement(zona) / baseline).
 *
 * El 7M es zona propia con xG fijo, fuera del juego abierto: no usa zona de pista.
 *
 * Los coeficientes son FIJOS DE REFERENCIA (primera vuelta), inyectables por club
 * vía xg_coefficients.json sin desplegar. Son priors sobre los que el modelo trabaja;
 * se recalibran cuando la plataforma acumule tiros propios suficientes.
 */

export interface XgCoefficients {
  /** Probabilidad base de gol por zona de lanzamiento (input de xG). */
  xgByOrigin: Record<ShotOrigin, number>;
  /** xG fijo del lanzamiento de 7 metros. */
  penaltyXg: number;
  /** Probabilidad de gol por zona de portería 1..9 (input de xGOT). */
  placementByZone: Record<number, number>;
  /** Conversión media ponderada sobre todas las zonas: normaliza la colocación. */
  placementBaseline: number;
}

/** Coeficientes por defecto — derivados de la primera vuelta del club (ver xg_coefficients.json). */
export const DEFAULT_XG: XgCoefficients = {
  xgByOrigin: {
    [ShotOrigin.WING_LEFT]:   0.61,
    [ShotOrigin.WING_RIGHT]:  0.63,
    [ShotOrigin.SIX_LEFT]:    0.66,
    [ShotOrigin.SIX_CENTER]:  0.70,
    [ShotOrigin.SIX_RIGHT]:   0.62,
    [ShotOrigin.NINE_LEFT]:   0.45,
    [ShotOrigin.NINE_CENTER]: 0.45,
    [ShotOrigin.NINE_RIGHT]:  0.45,
  },
  penaltyXg: 0.75,
  placementByZone: {
    1: 0.808, 2: 0.717, 3: 0.641,
    4: 0.662, 5: 0.125, 6: 0.722,
    7: 0.835, 8: 0.844, 9: 0.710,
  },
  placementBaseline: 0.728,
};

export interface XgInput {
  origin?: ShotOrigin | null;
  /** Zona de portería 1..9 (colocación). Solo si el tiro va a puerta. */
  zone?: number | null;
  isPenalty?: boolean;
  /** true si el tiro fue a puerta (gol o parada). Necesario para que xGOT tenga sentido. */
  onTarget: boolean;
}

export interface XgResult {
  /** Expected goals: probabilidad de gol por la posición de lanzamiento. */
  xg: number;
  /**
   * Expected goals on target: xG ajustado por colocación.
   * null si el tiro no va a puerta o no se marcó la zona (no se puede evaluar la colocación).
   */
  xgot: number | null;
}

/**
 * Computa xG y xGOT de un tiro.
 *
 * - Penalti: xG fijo, xGOT = mismo valor (la colocación del 7m no se modela por zona aquí).
 * - Tiro en juego: xG por zona de lanzamiento. Si va a puerta y hay zona marcada,
 *   xGOT escala el xG por el factor de colocación relativo al baseline.
 */
export function computeXg(input: XgInput, coeff: XgCoefficients = DEFAULT_XG): XgResult {
  if (input.isPenalty) {
    // El 7m no usa zona de pista; es su propia categoría con xG fijo.
    return { xg: coeff.penaltyXg, xgot: input.onTarget ? coeff.penaltyXg : null };
  }

  // Sin zona de lanzamiento no hay xG (dato incompleto): devolvemos 0, no inventamos.
  const xg = input.origin != null ? (coeff.xgByOrigin[input.origin] ?? 0) : 0;

  // xGOT solo si el tiro va a puerta Y se marcó la zona de portería.
  let xgot: number | null = null;
  if (input.onTarget && input.zone != null) {
    const placement = coeff.placementByZone[input.zone];
    if (placement != null && coeff.placementBaseline > 0) {
      // Escala el xG por lo buena/mala que sea la colocación respecto a la media.
      // Colocación en zona 5 (centro, muy parada) reduce el xGOT; esquinas bajas lo suben.
      xgot = xg * (placement / coeff.placementBaseline);
    }
  }

  return { xg, xgot };
}

/** Agrega xG/xGOT de una lista de tiros. Útil para totales de equipo/jugador. */
export function sumXg(shots: XgInput[], coeff: XgCoefficients = DEFAULT_XG): { xg: number; xgot: number } {
  let xg = 0, xgot = 0;
  for (const s of shots) {
    const r = computeXg(s, coeff);
    xg += r.xg;
    if (r.xgot != null) xgot += r.xgot;
  }
  return { xg: round2(xg), xgot: round2(xgot) };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
