import type { UiEvent, UiTeam, Side } from '../handball/mapping';
import { EventType, ShotOrigin, ShotOutcome, liveStats } from '../handball/mapping';
import type { CaptureMode, LoadedMatch, MatchListItem, MatchStatus } from '../../features/matches/types';
import type { CreateMatchInput, MatchesRepository } from '../../features/matches/repository';
import { toListItem, newMatchId } from '../../features/matches/repository';
import { cloneSeed } from '../../features/matches/seed-data';
import { migrate } from './migrate';
import { getPool, asJson, type Queryable } from './pg';

const SIDES: Side[] = ['HOME', 'AWAY'];

function rowToUiEvent(r: any): UiEvent {
  const payload = asJson<{ outcome?: string | null; origin?: string | null; zone?: number | null; blockerNumber?: number | null }>(r.payload ?? {});
  return {
    id: r.seq,
    t: r.game_clock_ms / 1000,
    period: r.period,
    side: r.side as Side,
    playerNumber: r.player_number ?? null,
    type: r.type as EventType,
    outcome: (payload.outcome ?? null) as ShotOutcome | null,
    zone: payload.zone ?? null,
    origin: (payload.origin ?? null) as ShotOrigin | null,
    blockerNumber: payload.blockerNumber ?? null,
  };
}

const gkFirst = (players: UiTeam['players']) =>
  [...players].sort((a, b) => Number(!!b.gk) - Number(!!a.gk) || a.number - b.number);

export interface PgMatchesRepository extends MatchesRepository {
  init(): Promise<void>;
}

export function makePgMatchesRepository(db: Queryable): PgMatchesRepository {
  async function insertEvents(matchId: string, events: UiEvent[]): Promise<void> {
    const sorted = [...events].sort((a, b) => a.t - b.t);
    let seq = 0;
    for (const e of sorted) {
      await db.query(
        `INSERT INTO match_event(match_id, seq, game_clock_ms, period, side, player_number, type, payload)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
        [matchId, seq++, Math.round(e.t * 1000), e.period, e.side, e.playerNumber ?? null, e.type,
         JSON.stringify({ outcome: e.outcome ?? null, origin: e.origin ?? null, zone: e.zone ?? null, blockerNumber: e.blockerNumber ?? null })],
      );
    }
  }

  async function insertMatch(m: LoadedMatch): Promise<void> {
    await db.query(
      `INSERT INTO match(id, competition, matchday, played_at, status, mode, period_minutes, video_ref)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [m.matchId, m.competition ?? null, m.matchday ?? null, m.playedAt ?? null, m.status,
       m.mode, m.periodMinutes ?? null, m.videoRef ?? null],
    );
    for (const side of SIDES) {
      const team = side === 'HOME' ? m.home : m.away;
      await db.query('INSERT INTO team(match_id, side, name) VALUES ($1,$2,$3)', [m.matchId, side, team.name]);
      for (const p of team.players) {
        await db.query(
          'INSERT INTO player(match_id, side, number, name, gk, starter) VALUES ($1,$2,$3,$4,$5,$6)',
          [m.matchId, side, p.number, p.name, !!p.gk, true],
        );
      }
    }
    await insertEvents(m.matchId, m.events);
  }

  const repo: PgMatchesRepository = {
    async init() {
      await migrate(db);
      const n = Number((await db.query('SELECT count(*) AS n FROM match')).rows[0].n);
      if (n === 0) for (const m of cloneSeed()) await insertMatch(m);
    },

    async get(matchId) {
      const mrow = (await db.query('SELECT * FROM match WHERE id=$1', [matchId])).rows[0];
      if (!mrow) return null;
      const teams = (await db.query('SELECT * FROM team WHERE match_id=$1', [matchId])).rows;
      const players = (await db.query('SELECT * FROM player WHERE match_id=$1 ORDER BY number', [matchId])).rows;
      const events = (await db.query('SELECT * FROM match_event WHERE match_id=$1 ORDER BY seq', [matchId])).rows;

      const teamOf = (side: Side): UiTeam => ({
        name: teams.find((t) => t.side === side)?.name ?? side,
        players: gkFirst(players.filter((p) => p.side === side).map((p) => ({ number: p.number, name: p.name, gk: !!p.gk }))),
      });

      return {
        matchId: mrow.id,
        competition: mrow.competition ?? undefined,
        matchday: mrow.matchday ?? undefined,
        playedAt: mrow.played_at ? new Date(mrow.played_at).toISOString() : undefined,
        home: teamOf('HOME'),
        away: teamOf('AWAY'),
        events: events.map(rowToUiEvent),
        status: mrow.status as MatchStatus,
        mode: (mrow.mode ?? 'video') as CaptureMode,
        periodMinutes: mrow.period_minutes ?? undefined,
        videoRef: mrow.video_ref ?? null,
      };
    },

    async create(input: CreateMatchInput) {
      const match: LoadedMatch = {
        matchId: newMatchId(input.mode === 'live' ? 'LIVE' : 'VID'),
        competition: input.competition, matchday: input.matchday,
        playedAt: input.playedAt ?? new Date().toISOString(),
        home: input.home, away: input.away, events: [], status: 'new',
        mode: input.mode, periodMinutes: input.periodMinutes, videoRef: null,
      };
      await insertMatch(match);
      return match;
    },

    async list() {
      const ids = (await db.query('SELECT id FROM match ORDER BY id')).rows.map((r) => r.id as string);
      const items: MatchListItem[] = [];
      for (const id of ids) {
        const m = await repo.get(id);
        if (m) items.push(toListItem(m));
      }
      return items;
    },

    async saveEvents(matchId, events) {
      await db.query('DELETE FROM match_event WHERE match_id=$1', [matchId]);
      await insertEvents(matchId, events);
      await db.query("UPDATE match SET status='tagging' WHERE id=$1 AND status='new'", [matchId]);
    },

    async markExtracted(matchId) {
      const m = await repo.get(matchId);
      if (!m) return;
      const stats = liveStats(
        { matchId: m.matchId, competition: m.competition, matchday: m.matchday, playedAt: m.playedAt },
        m.events, m.home, m.away,
      );
      await db.query('DELETE FROM match_read_model WHERE match_id=$1', [matchId]);
      await db.query(
        'INSERT INTO match_read_model(match_id, summary, players) VALUES ($1,$2::jsonb,$3::jsonb)',
        [matchId, JSON.stringify(stats.summary), JSON.stringify(stats.players)],
      );
      await db.query("UPDATE match SET status='extracted' WHERE id=$1", [matchId]);
    },

    async setVideo(matchId, videoRef) {
      await db.query('UPDATE match SET video_ref=$2 WHERE id=$1', [matchId, videoRef]);
    },
  };

  return repo;
}

// --- Instancia para producción (pool real + init memoizado) ---
let initPromise: Promise<void> | null = null;

export function createPgMatchesRepo(): MatchesRepository {
  const repo = makePgMatchesRepository(getPool());
  const ensure = () => (initPromise ??= repo.init());
  return {
    async list() { await ensure(); return repo.list(); },
    async create(i) { await ensure(); return repo.create(i); },
    async get(id) { await ensure(); return repo.get(id); },
    async saveEvents(id, e) { await ensure(); return repo.saveEvents(id, e); },
    async markExtracted(id) { await ensure(); return repo.markExtracted(id); },
    async setVideo(id, r) { await ensure(); return repo.setVideo(id, r); },
  };
}
