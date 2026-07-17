/**
 * Puesto canónico (inglés) del jugador.
 * Regla de normalización ES/EN acordada: POR/GK, LI/LB, LD/RB, CE/CB, EI/LW, ED/RW, PIV/LP.
 * El resto de la plataforma trabaja SIEMPRE con estos valores; las grafías de origen
 * (informe, etiquetado, CV) se traducen en el borde de ingesta.
 */
export enum Position {
  GK = 'GK', // Portero / Portera
  LB = 'LB', // Lateral izquierdo
  CB = 'CB', // Central
  RB = 'RB', // Lateral derecho
  LW = 'LW', // Extremo izquierdo
  RW = 'RW', // Extremo derecho
  LP = 'LP', // Pivote (line player)
}

const POSITION_ALIASES: Readonly<Record<string, Position>> = {
  // Español
  POR: Position.GK, PT: Position.GK, PORTERO: Position.GK,
  LI: Position.LB, LD: Position.RB,
  CE: Position.CB, CEN: Position.CB, CENTRAL: Position.CB,
  EI: Position.LW, ED: Position.RW,
  PIV: Position.LP, PIVOTE: Position.LP,
  // Inglés (idempotente)
  GK: Position.GK, LB: Position.LB, CB: Position.CB, RB: Position.RB,
  LW: Position.LW, RW: Position.RW, LP: Position.LP,
};

export function normalizePosition(raw: string): Position {
  const key = raw.trim().toUpperCase();
  const pos = POSITION_ALIASES[key];
  if (!pos) {
    throw new Error(`Puesto desconocido: "${raw}". Amplía POSITION_ALIASES en el borde de ingesta.`);
  }
  return pos;
}
