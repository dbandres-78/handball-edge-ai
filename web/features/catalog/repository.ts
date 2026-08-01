import type {
  Season, Club, RosterPlayer, RosterPlayerRef, NewClubInput, NewRosterPlayerInput, RosterPlayerPatch,
} from './types';

/**
 * Repositorio del catálogo persistente. La implementación por defecto es en memoria
 * (dev/demo, sin DATABASE_URL). La de Postgres (lib/db/catalog-repo.pg) implementa esta
 * misma interfaz — misma forma que el repositorio de partidos.
 */
export interface CatalogRepository {
  // Temporadas
  listSeasons(): Promise<Season[]>;
  ensureSeason(code: string, label?: string): Promise<Season>;

  // Clubes (persisten entre temporadas)
  listClubs(): Promise<Club[]>;
  getClub(id: string): Promise<Club | null>;
  createClub(input: NewClubInput): Promise<Club>;
  updateClub(id: string, patch: Partial<NewClubInput>): Promise<Club | null>;

  // Plantilla (por club + temporada)
  listRoster(clubId: string, season: string): Promise<RosterPlayer[]>;
  addPlayer(input: NewRosterPlayerInput): Promise<RosterPlayer>;
  updatePlayer(id: string, patch: RosterPlayerPatch): Promise<RosterPlayer | null>;
  removePlayer(id: string): Promise<void>;

  // Identidad global de jugador (carrera entre clubes)
  getPlayer(id: string): Promise<RosterPlayer | null>;
  listAllRoster(): Promise<RosterPlayerRef[]>;
  listByPerson(personId: string): Promise<RosterPlayer[]>;
  /** Une la identidad del jugador `sourceId` a la de `targetId` (comparten person_id). */
  mergePersons(sourceId: string, targetId: string): Promise<void>;
  /** Borra TODAS las pertenencias de una persona (borrado definitivo del jugador del catálogo). */
  removePersonPlayers(personId: string): Promise<void>;
}

/** Id legible + sufijo aleatorio, mismo criterio anticolisión que newMatchId. */
export function newCatalogId(prefix: string): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}-${stamp}-${rand}`;
}

// --- Implementación en memoria (se reinicia con el servidor) ---
const seasons = new Map<string, Season>();
const clubs = new Map<string, Club>();
const roster = new Map<string, RosterPlayer>();

export const inMemoryCatalogRepo: CatalogRepository = {
  async listSeasons() {
    return [...seasons.values()].sort((a, b) => a.code.localeCompare(b.code));
  },
  async ensureSeason(code, label) {
    const existing = seasons.get(code);
    if (existing) return existing;
    const s: Season = { code, label };
    seasons.set(code, s);
    return s;
  },

  async listClubs() {
    return [...clubs.values()].sort((a, b) => a.name.localeCompare(b.name));
  },
  async getClub(id) {
    return clubs.get(id) ?? null;
  },
  async createClub(input) {
    const club: Club = { id: newCatalogId('CLUB'), name: input.name, shortName: input.shortName, color: input.color };
    clubs.set(club.id, club);
    return club;
  },
  async updateClub(id, patch) {
    const c = clubs.get(id);
    if (!c) return null;
    const next: Club = { ...c, ...patch };
    clubs.set(id, next);
    return next;
  },

  async listRoster(clubId, season) {
    return [...roster.values()]
      .filter((r) => r.clubId === clubId && r.season === season)
      .sort((a, b) => a.number - b.number);
  },
  async addPlayer(input) {
    // Auto-vínculo: mismo club + mismo dorsal + mismo nombre en otra temporada = misma persona.
    const norm = (s: string) => s.trim().toLowerCase();
    const twin = [...roster.values()].find(
      (r) => r.clubId === input.clubId && r.number === input.number && norm(r.name) === norm(input.name),
    );
    const id = newCatalogId('RP');
    const rp: RosterPlayer = {
      id, clubId: input.clubId, season: input.season,
      number: input.number, name: input.name, position: input.position,
      personId: twin?.personId ?? id, active: true,
    };
    roster.set(rp.id, rp);
    return rp;
  },
  async updatePlayer(id, patch) {
    const rp = roster.get(id);
    if (!rp) return null;
    const next: RosterPlayer = { ...rp, ...patch };
    roster.set(id, next);
    return next;
  },
  async removePlayer(id) {
    roster.delete(id);
  },

  async getPlayer(id) {
    return roster.get(id) ?? null;
  },
  async listAllRoster() {
    return [...roster.values()]
      .map((r) => ({ ...r, clubName: clubs.get(r.clubId)?.name ?? '—' }))
      .sort((a, b) => a.clubName.localeCompare(b.clubName) || b.season.localeCompare(a.season) || a.number - b.number);
  },
  async listByPerson(personId) {
    return [...roster.values()].filter((r) => r.personId === personId)
      .sort((a, b) => b.season.localeCompare(a.season));
  },
  async mergePersons(sourceId, targetId) {
    const src = roster.get(sourceId); const tgt = roster.get(targetId);
    if (!src || !tgt || src.personId === tgt.personId) return;
    const from = src.personId; const to = tgt.personId;
    for (const r of roster.values()) if (r.personId === from) roster.set(r.id, { ...r, personId: to });
  },
  async removePersonPlayers(personId) {
    for (const r of [...roster.values()]) if (r.personId === personId) roster.delete(r.id);
  },
};

/** Selector: usa Postgres si hay DATABASE_URL; si no, memoria. */
export async function getCatalogRepo(): Promise<CatalogRepository> {
  if (process.env.DATABASE_URL) {
    const { createPgCatalogRepo } = await import('../../lib/db/catalog-repo.pg');
    return createPgCatalogRepo();
  }
  return inMemoryCatalogRepo;
}
