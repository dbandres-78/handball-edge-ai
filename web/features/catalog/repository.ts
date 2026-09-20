import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
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

// --- Implementación en memoria (dev/demo), respaldada en disco ---
//
// Next.js, en modo `next dev`, puede compilar cada ruta de API (`route.ts`) como su propio
// "entry" bajo demanda: la primera vez que se pide `/api/catalog/clubs/[clubId]/projection`
// en una sesión del servidor, puede acabar con SU PROPIA instancia de este módulo — y por tanto
// sus propios `Map` vacíos — aunque `/api/catalog/clubs` (listar/crear) ya llevara rato
// funcionando con los suyos. Sin esto, un club recién creado aparece en el listado pero su
// ficha individual da "no encontrado", de forma intermitente y difícil de reproducir a propósito.
//
// La solución sin montar Postgres: usar un fichero JSON en `.data/` como fuente de verdad y
// releer de disco al principio de cada operación. Así da igual cuántas instancias del módulo
// haya en memoria — todas acaban viendo el mismo estado. `.data/` ya está en `.gitignore`.
const seasons = new Map<string, Season>();
const clubs = new Map<string, Club>();
const roster = new Map<string, RosterPlayer>();

const DATA_FILE = join(process.cwd(), '.data', 'catalog.json');

interface PersistedCatalog {
  seasons: Season[];
  clubs: Club[];
  roster: RosterPlayer[];
}

/** Relee el fichero de disco y sustituye el contenido de los Map en memoria por el suyo. */
async function loadPersisted(): Promise<void> {
  try {
    const raw = await readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw) as PersistedCatalog;
    seasons.clear(); for (const s of parsed.seasons ?? []) seasons.set(s.code, s);
    clubs.clear(); for (const c of parsed.clubs ?? []) clubs.set(c.id, c);
    roster.clear(); for (const r of parsed.roster ?? []) roster.set(r.id, r);
  } catch {
    // No existe todavía (primer arranque) o está corrupto: se sigue con lo que hubiera en memoria.
  }
}

/** Vuelca el estado actual de los Map al fichero de disco. */
async function persist(): Promise<void> {
  try {
    await mkdir(join(process.cwd(), '.data'), { recursive: true });
    const state: PersistedCatalog = {
      seasons: [...seasons.values()], clubs: [...clubs.values()], roster: [...roster.values()],
    };
    await writeFile(DATA_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch {
    // Si falla el guardado en disco (permisos, disco lleno...) no bloquea la operación en curso;
    // esa instancia del módulo se queda con el dato en memoria hasta el próximo `loadPersisted`.
  }
}

export const inMemoryCatalogRepo: CatalogRepository = {
  async listSeasons() {
    await loadPersisted();
    return [...seasons.values()].sort((a, b) => a.code.localeCompare(b.code));
  },
  async ensureSeason(code, label) {
    await loadPersisted();
    const existing = seasons.get(code);
    if (existing) return existing;
    const s: Season = { code, label };
    seasons.set(code, s);
    await persist();
    return s;
  },

  async listClubs() {
    await loadPersisted();
    return [...clubs.values()].sort((a, b) => a.name.localeCompare(b.name));
  },
  async getClub(id) {
    await loadPersisted();
    return clubs.get(id) ?? null;
  },
  async createClub(input) {
    await loadPersisted();
    const club: Club = { id: newCatalogId('CLUB'), name: input.name, shortName: input.shortName, color: input.color };
    clubs.set(club.id, club);
    await persist();
    return club;
  },
  async updateClub(id, patch) {
    await loadPersisted();
    const c = clubs.get(id);
    if (!c) return null;
    // Fusión campo a campo (no spread ciego): un patch parcial no debe borrar los campos
    // que no vienen en él. `??` respeta explícitamente '' o false si se envían.
    const next: Club = {
      ...c,
      name: patch.name ?? c.name,
      shortName: patch.shortName ?? c.shortName,
      color: patch.color ?? c.color,
      photoUrl: patch.photoUrl ?? c.photoUrl,
    };
    clubs.set(id, next);
    await persist();
    return next;
  },

  async listRoster(clubId, season) {
    await loadPersisted();
    return [...roster.values()]
      .filter((r) => r.clubId === clubId && r.season === season)
      .sort((a, b) => a.number - b.number);
  },
  async addPlayer(input) {
    await loadPersisted();
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
    await persist();
    return rp;
  },
  async updatePlayer(id, patch) {
    await loadPersisted();
    const rp = roster.get(id);
    if (!rp) return null;
    const next: RosterPlayer = {
      ...rp,
      number: patch.number ?? rp.number,
      name: patch.name ?? rp.name,
      position: patch.position ?? rp.position,
      active: patch.active ?? rp.active,
      photoUrl: patch.photoUrl ?? rp.photoUrl,
    };
    roster.set(id, next);
    await persist();
    return next;
  },
  async removePlayer(id) {
    await loadPersisted();
    roster.delete(id);
    await persist();
  },

  async getPlayer(id) {
    await loadPersisted();
    return roster.get(id) ?? null;
  },
  async listAllRoster() {
    await loadPersisted();
    return [...roster.values()]
      .map((r) => ({ ...r, clubName: clubs.get(r.clubId)?.name ?? '—' }))
      .sort((a, b) => a.clubName.localeCompare(b.clubName) || b.season.localeCompare(a.season) || a.number - b.number);
  },
  async listByPerson(personId) {
    await loadPersisted();
    return [...roster.values()].filter((r) => r.personId === personId)
      .sort((a, b) => b.season.localeCompare(a.season));
  },
  async mergePersons(sourceId, targetId) {
    await loadPersisted();
    const src = roster.get(sourceId); const tgt = roster.get(targetId);
    if (!src || !tgt || src.personId === tgt.personId) return;
    const from = src.personId; const to = tgt.personId;
    for (const r of roster.values()) if (r.personId === from) roster.set(r.id, { ...r, personId: to });
    await persist();
  },
  async removePersonPlayers(personId) {
    await loadPersisted();
    for (const r of [...roster.values()]) if (r.personId === personId) roster.delete(r.id);
    await persist();
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
