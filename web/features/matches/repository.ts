import type { UiEvent } from '../../lib/handball/mapping';
import { liveStats } from '../../lib/handball/mapping';
import type { CaptureMode, LoadedMatch, MatchListItem, MatchStatus } from './types';
import { cloneSeed } from './seed-data';

/**
 * Repositorio de partidos. La implementación por defecto es en memoria (dev/demo).
 * La de Postgres (lib/db) implementa esta misma interfaz — la web no cambia.
 */
export interface CreateMatchInput {
  competition?: string;
  matchday?: number;
  playedAt?: string;
  home: { name: string; players: LoadedMatch['home']['players'] };
  away: { name: string; players: LoadedMatch['away']['players'] };
  mode: CaptureMode;
  periodMinutes?: number;
}

export interface MatchesRepository {
  list(): Promise<MatchListItem[]>;
  create(input: CreateMatchInput): Promise<LoadedMatch>;
  get(matchId: string): Promise<LoadedMatch | null>;
  saveEvents(matchId: string, events: UiEvent[]): Promise<void>;
  markExtracted(matchId: string): Promise<void>;
  setVideo(matchId: string, videoRef: string): Promise<void>;
}

export function toListItem(m: LoadedMatch): MatchListItem {
  const s = liveStats({ matchId: m.matchId, competition: m.competition, matchday: m.matchday, playedAt: m.playedAt }, m.events, m.home, m.away);
  return {
    matchId: m.matchId, competition: m.competition, matchday: m.matchday, playedAt: m.playedAt,
    homeName: m.home.name, awayName: m.away.name,
    homeGoals: s.summary.home.goals, awayGoals: s.summary.away.goals,
    eventCount: m.events.length, status: m.status, mode: m.mode,
  };
}

/** Id legible y estable: LIVE-20260715-1432 / VID-20260715-1432 */
export function newMatchId(prefix = 'M'): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  return `${prefix}-${stamp}`;
}

// --- Implementación en memoria (se reinicia con el servidor) ---
const store = new Map<string, LoadedMatch>();
function seed() {
  if (store.size) return;
  for (const m of cloneSeed()) store.set(m.matchId, m);
}

export const inMemoryMatchesRepo: MatchesRepository = {
  async list() { seed(); return [...store.values()].map(toListItem); },
  async create(input) {
    seed();
    const match: LoadedMatch = {
      matchId: newMatchId(input.mode === 'live' ? 'LIVE' : 'VID'), competition: input.competition, matchday: input.matchday,
      playedAt: input.playedAt ?? new Date().toISOString(),
      home: input.home, away: input.away, events: [], status: 'new',
      mode: input.mode, videoRef: null, periodMinutes: input.periodMinutes,
    };
    store.set(match.matchId, match);
    return match;
  },
  async get(matchId) { seed(); return store.get(matchId) ?? null; },
  async saveEvents(matchId, events) {
    seed();
    const m = store.get(matchId);
    if (m) store.set(matchId, { ...m, events, status: m.status === 'new' ? 'tagging' : m.status });
  },
  async markExtracted(matchId) {
    seed();
    const m = store.get(matchId);
    if (m) store.set(matchId, { ...m, status: 'extracted' as MatchStatus });
  },
  async setVideo(matchId, videoRef) {
    seed();
    const m = store.get(matchId);
    if (m) store.set(matchId, { ...m, videoRef });
  },
};

/** Selector: usa Postgres si hay DATABASE_URL; si no, memoria. */
export async function getMatchesRepo(): Promise<MatchesRepository> {
  if (process.env.DATABASE_URL) {
    const { createPgMatchesRepo } = await import('../../lib/db/matches-repo.pg');
    return createPgMatchesRepo();
  }
  return inMemoryMatchesRepo;
}

// Compatibilidad con imports previos.
export const matchesRepo = inMemoryMatchesRepo;
