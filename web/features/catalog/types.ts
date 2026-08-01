/**
 * Catálogo persistente (Fase A): temporadas, clubes y plantillas reutilizables.
 *
 * Principio de diseño: el club persiste entre temporadas, pero la plantilla es POR
 * temporada. La identidad de jugador está acotada a (club, temporada); vincular a la
 * misma persona a través de temporadas es un refinamiento futuro. La estadística
 * acumulada (Fase C) se proyecta por temporada, nunca mezclando temporadas.
 */

/** Una temporada como bucket independiente. `code` es su clave natural ('26/27'). */
export interface Season {
  code: string;
  label?: string;
}

/** Un club reutilizable, con identidad estable entre temporadas. */
export interface Club {
  id: string;
  name: string;
  shortName?: string;
  color?: string;
}

/** Pertenencia de un jugador a un club en una temporada, con su dorsal de esa temporada. */
export interface RosterPlayer {
  id: string;
  clubId: string;
  season: string;
  number: number;
  name: string;
  position?: string;
  personId: string;   // identidad global (carrera entre clubes); por defecto = id hasta que se vincula
  active: boolean;
}

/** Jugador de plantilla con el nombre de su club, para listados/selectores de vinculación. */
export interface RosterPlayerRef extends RosterPlayer {
  clubName: string;
}

export interface NewClubInput {
  name: string;
  shortName?: string;
  color?: string;
}

export interface NewRosterPlayerInput {
  clubId: string;
  season: string;
  number: number;
  name: string;
  position?: string;
}

/** Parche para editar un jugador de plantilla (sin mover su club/temporada). */
export interface RosterPlayerPatch {
  number?: number;
  name?: string;
  position?: string;
  active?: boolean;
}
