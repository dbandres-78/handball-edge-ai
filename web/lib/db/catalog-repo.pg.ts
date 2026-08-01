import type {
  Season, Club, RosterPlayer, RosterPlayerRef, NewClubInput, NewRosterPlayerInput, RosterPlayerPatch,
} from '../../features/catalog/types';
import type { CatalogRepository } from '../../features/catalog/repository';
import { newCatalogId } from '../../features/catalog/repository';
import { migrate } from './migrate';
import { getPool, type Queryable } from './pg';

const rowToClub = (r: any): Club => ({
  id: r.id, name: r.name, shortName: r.short_name ?? undefined, color: r.color ?? undefined,
});

const rowToPlayer = (r: any): RosterPlayer => ({
  id: r.id, clubId: r.club_id, season: r.season, number: r.number, name: r.name,
  position: r.position ?? undefined, personId: r.person_id ?? r.id, active: !!r.active,
});

export interface PgCatalogRepository extends CatalogRepository {
  init(): Promise<void>;
}

export function makePgCatalogRepository(db: Queryable): PgCatalogRepository {
  const repo: PgCatalogRepository = {
    // El catálogo comparte el mismo esquema/migración que los partidos. migrate() es
    // idempotente: crea las tablas del catálogo si faltan, sin sembrar partidos.
    async init() {
      await migrate(db);
    },

    async listSeasons() {
      const rows = (await db.query('SELECT code, label FROM season ORDER BY code')).rows;
      return rows.map((r) => ({ code: r.code, label: r.label ?? undefined } as Season));
    },
    async ensureSeason(code, label) {
      const found = (await db.query('SELECT code, label FROM season WHERE code=$1', [code])).rows[0];
      if (found) return { code: found.code, label: found.label ?? undefined };
      await db.query('INSERT INTO season(code, label) VALUES ($1,$2)', [code, label ?? null]);
      return { code, label };
    },

    async listClubs() {
      const rows = (await db.query('SELECT * FROM club ORDER BY name')).rows;
      return rows.map(rowToClub);
    },
    async getClub(id) {
      const r = (await db.query('SELECT * FROM club WHERE id=$1', [id])).rows[0];
      return r ? rowToClub(r) : null;
    },
    async createClub(input: NewClubInput) {
      const club: Club = { id: newCatalogId('CLUB'), name: input.name, shortName: input.shortName, color: input.color };
      await db.query(
        'INSERT INTO club(id, name, short_name, color) VALUES ($1,$2,$3,$4)',
        [club.id, club.name, club.shortName ?? null, club.color ?? null],
      );
      return club;
    },
    async updateClub(id, patch) {
      const current = await repo.getClub(id);
      if (!current) return null;
      const next: Club = { ...current, ...patch };
      await db.query(
        'UPDATE club SET name=$2, short_name=$3, color=$4 WHERE id=$1',
        [id, next.name, next.shortName ?? null, next.color ?? null],
      );
      return next;
    },

    async listRoster(clubId, season) {
      const rows = (await db.query(
        'SELECT * FROM roster_player WHERE club_id=$1 AND season=$2 ORDER BY number',
        [clubId, season],
      )).rows;
      return rows.map(rowToPlayer);
    },
    async addPlayer(input: NewRosterPlayerInput) {
      // Auto-vínculo: mismo club + dorsal + nombre en otra temporada = misma persona.
      // (Normalización del nombre en JS: pg-mem no implementa trim/lower.)
      const norm = (s: string) => s.trim().toLowerCase();
      const candidates = (await db.query(
        'SELECT person_id, name FROM roster_player WHERE club_id=$1 AND number=$2',
        [input.clubId, input.number],
      )).rows;
      const twin = candidates.find((r) => norm(r.name) === norm(input.name));
      const id = newCatalogId('RP');
      const personId: string = twin?.person_id ?? id;
      const rp: RosterPlayer = {
        id, clubId: input.clubId, season: input.season,
        number: input.number, name: input.name, position: input.position, personId, active: true,
      };
      await db.query(
        'INSERT INTO roster_player(id, club_id, season, number, name, position, person_id, active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [rp.id, rp.clubId, rp.season, rp.number, rp.name, rp.position ?? null, rp.personId, rp.active],
      );
      return rp;
    },
    async updatePlayer(id, patch: RosterPlayerPatch) {
      const current = (await db.query('SELECT * FROM roster_player WHERE id=$1', [id])).rows[0];
      if (!current) return null;
      const next = rowToPlayer({ ...current, ...toRow(patch, current) });
      await db.query(
        'UPDATE roster_player SET number=$2, name=$3, position=$4, active=$5 WHERE id=$1',
        [id, next.number, next.name, next.position ?? null, next.active],
      );
      return next;
    },
    async removePlayer(id) {
      await db.query('DELETE FROM roster_player WHERE id=$1', [id]);
    },

    async getPlayer(id) {
      const r = (await db.query('SELECT * FROM roster_player WHERE id=$1', [id])).rows[0];
      return r ? rowToPlayer(r) : null;
    },
    async listAllRoster() {
      const rows = (await db.query(
        `SELECT rp.*, c.name AS club_name FROM roster_player rp
         LEFT JOIN club c ON c.id = rp.club_id
         ORDER BY c.name, rp.season DESC, rp.number`,
      )).rows;
      return rows.map((r) => ({ ...rowToPlayer(r), clubName: r.club_name ?? '—' } as RosterPlayerRef));
    },
    async listByPerson(personId) {
      const rows = (await db.query('SELECT * FROM roster_player WHERE person_id=$1 ORDER BY season DESC', [personId])).rows;
      return rows.map(rowToPlayer);
    },
    async mergePersons(sourceId, targetId) {
      const src = (await db.query('SELECT person_id FROM roster_player WHERE id=$1', [sourceId])).rows[0];
      const tgt = (await db.query('SELECT person_id FROM roster_player WHERE id=$1', [targetId])).rows[0];
      if (!src || !tgt || src.person_id === tgt.person_id) return;
      await db.query('UPDATE roster_player SET person_id=$2 WHERE person_id=$1', [src.person_id, tgt.person_id]);
    },
    async removePersonPlayers(personId) {
      await db.query('DELETE FROM roster_player WHERE person_id=$1', [personId]);
    },
  };

  return repo;
}

/** Aplica un parche parcial sobre la fila cruda respetando los valores actuales. */
function toRow(patch: RosterPlayerPatch, current: any) {
  return {
    number: patch.number ?? current.number,
    name: patch.name ?? current.name,
    position: patch.position ?? current.position,
    active: patch.active ?? current.active,
  };
}

// --- Instancia para producción (pool real + init memoizado) ---
let initPromise: Promise<void> | null = null;

export function createPgCatalogRepo(): CatalogRepository {
  const repo = makePgCatalogRepository(getPool());
  const ensure = () => (initPromise ??= repo.init());
  return {
    async listSeasons() { await ensure(); return repo.listSeasons(); },
    async ensureSeason(c, l) { await ensure(); return repo.ensureSeason(c, l); },
    async listClubs() { await ensure(); return repo.listClubs(); },
    async getClub(id) { await ensure(); return repo.getClub(id); },
    async createClub(i) { await ensure(); return repo.createClub(i); },
    async updateClub(id, p) { await ensure(); return repo.updateClub(id, p); },
    async listRoster(c, s) { await ensure(); return repo.listRoster(c, s); },
    async addPlayer(i) { await ensure(); return repo.addPlayer(i); },
    async updatePlayer(id, p) { await ensure(); return repo.updatePlayer(id, p); },
    async removePlayer(id) { await ensure(); return repo.removePlayer(id); },
    async getPlayer(id) { await ensure(); return repo.getPlayer(id); },
    async listAllRoster() { await ensure(); return repo.listAllRoster(); },
    async listByPerson(pid) { await ensure(); return repo.listByPerson(pid); },
    async mergePersons(s, t) { await ensure(); return repo.mergePersons(s, t); },
    async removePersonPlayers(pid) { await ensure(); return repo.removePersonPlayers(pid); },
  };
}
