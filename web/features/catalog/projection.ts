import { liveStats, Side } from '@/lib/handball/mapping';
import type { LoadedMatch } from '@/features/matches/types';
import type { OnCourtSplits } from '@handball/core';

/**
 * Fichas de club por temporada como PROYECCIÓN on-demand: recorre los partidos enlazados a ese
 * club en esa temporada, recompone cada uno desde sus eventos (liveStats) y agrega. Sin tabla
 * nueva. Los jugadores se agregan por su `playerId` de catálogo (estable dentro de club+temporada),
 * no por el id canónico del partido.
 */

export interface PlayerEff {
  offensive: number | null;   // ataque posicional (goles/posesiones on-court)
  counter: number | null;     // contraataque
  defensive: number | null;   // defensa posicional (1 − eficiencia rival)
  recovery: number | null;    // repliegue (defensa vs contraataque rival)
}
export interface PlayerCard {
  playerId: string; personId: string; number: number; name: string; position: string;
  games: number;
  minutesTotal: number; minutesAvg: number | null;
  playScoreTotal: number; playScoreAvg: number | null;
  goals: number; shots: number; shotPct: number | null;
  turnovers: number; steals: number; xg: number;
  plusMinusTotal: number; plusMinusAvg: number | null;
  turnoverRate: number | null;   // % pérdidas por posesiones jugadas (pérdidas / offPoss)
  eff: PlayerEff;
}
export interface TeamCard {
  games: number; wins: number; draws: number; losses: number;
  playScoreTotal: number; playScoreAvg: number | null;   // suma del Play Score de los jugadores (y media por partido)
  goalsFor: number; goalsAgainst: number; goalsForAvg: number | null; goalsAgainstAvg: number | null;
  possessionsAvg: number | null; turnoverPct: number | null; shootingPct: number | null;
  phaseEff: { positional: number | null; counter: number | null };
  ranking: { playerId: string; name: string; number: number; playScoreTotal: number }[];
}
export interface ClubProjection {
  clubId: string; season: string; games: number;
  team: TeamCard; players: PlayerCard[];
}

interface PlayerAgg {
  playerId: string; number: number; name: string; position: string;
  games: number; minutes: number; playScore: number; goals: number; shots: number; misses: number;
  turnovers: number; steals: number; xg: number; plusMinus: number; oc: OnCourtSplits;
}

const pct = (num: number, den: number): number | null => (den > 0 ? Math.round((num / den) * 1000) / 10 : null);
const round1 = (n: number): number => Math.round(n * 10) / 10;
const round2 = (n: number): number => Math.round(n * 100) / 100;
const emptyOc = (): OnCourtSplits => ({
  offPoss: 0, defPoss: 0, offPosPoss: 0, offPosGoals: 0, offCntPoss: 0, offCntGoals: 0,
  defPosPoss: 0, defPosGoals: 0, defCntPoss: 0, defCntGoals: 0,
});
const addOc = (a: OnCourtSplits, b: OnCourtSplits) => {
  a.offPoss += b.offPoss; a.defPoss += b.defPoss;
  a.offPosPoss += b.offPosPoss; a.offPosGoals += b.offPosGoals;
  a.offCntPoss += b.offCntPoss; a.offCntGoals += b.offCntGoals;
  a.defPosPoss += b.defPosPoss; a.defPosGoals += b.defPosGoals;
  a.defCntPoss += b.defCntPoss; a.defCntGoals += b.defCntGoals;
};

type PlayerLineLike = ReturnType<typeof liveStats>['players'][number];

const emptyAgg = (playerId: string, pl: PlayerLineLike): PlayerAgg => ({
  playerId, number: pl.number, name: pl.name, position: pl.position,
  games: 0, minutes: 0, playScore: 0, goals: 0, shots: 0, misses: 0,
  turnovers: 0, steals: 0, xg: 0, plusMinus: 0, oc: emptyOc(),
});

/** Suma la línea de un jugador en un partido al acumulado. */
const accPlayer = (agg: PlayerAgg, pl: PlayerLineLike) => {
  const played = pl.onCourt.offPoss + pl.onCourt.defPoss > 0 || pl.shots > 0 || pl.turnovers > 0 || pl.steals > 0 || pl.saves > 0;
  if (played) agg.games++;
  agg.minutes += pl.minutesPlayed;
  agg.playScore += pl.playScore.total;
  agg.goals += pl.goals; agg.shots += pl.shots; agg.misses += pl.misses;
  agg.turnovers += pl.turnovers; agg.steals += pl.steals; agg.xg += pl.xg; agg.plusMinus += pl.plusMinus;
  addOc(agg.oc, pl.onCourt);
  agg.name = pl.name || agg.name;
};

/** Convierte el acumulado en ficha con porcentajes derivados. */
const cardOf = (a: PlayerAgg): PlayerCard => ({
  playerId: a.playerId, personId: a.playerId, number: a.number, name: a.name, position: a.position,
  games: a.games,
  minutesTotal: round1(a.minutes), minutesAvg: a.games > 0 ? round1(a.minutes / a.games) : null,
  playScoreTotal: round2(a.playScore),
  playScoreAvg: a.games > 0 ? round2(a.playScore / a.games) : null,
  goals: a.goals, shots: a.shots, shotPct: pct(a.goals, a.shots),
  turnovers: a.turnovers, steals: a.steals, xg: round2(a.xg),
  plusMinusTotal: round1(a.plusMinus), plusMinusAvg: a.games > 0 ? round1(a.plusMinus / a.games) : null,
  turnoverRate: pct(a.turnovers, a.oc.offPoss),
  eff: {
    offensive: pct(a.oc.offPosGoals, a.oc.offPosPoss),
    counter: pct(a.oc.offCntGoals, a.oc.offCntPoss),
    defensive: a.oc.defPosPoss > 0 ? round1(100 - (a.oc.defPosGoals / a.oc.defPosPoss) * 100) : null,
    recovery: a.oc.defCntPoss > 0 ? round1(100 - (a.oc.defCntGoals / a.oc.defCntPoss) * 100) : null,
  },
});

export function isLinkedToClub(m: LoadedMatch, clubId: string, season: string): boolean {
  return (m.season ?? undefined) === season && (m.home.clubId === clubId || m.away.clubId === clubId);
}

export function buildClubProjection(matches: LoadedMatch[], clubId: string, season: string): ClubProjection {
  const relevant = matches.filter((m) => isLinkedToClub(m, clubId, season));

  let games = 0, wins = 0, draws = 0, losses = 0, gf = 0, ga = 0;
  let poss = 0, turnovers = 0, shots = 0, goals = 0;
  let gPos = 0, pPos = 0, gCnt = 0, pCnt = 0;
  const players = new Map<string, PlayerAgg>();

  for (const m of relevant) {
    const stats = liveStats(
      { matchId: m.matchId, playedAt: m.playedAt ?? '', competition: m.competition, matchday: m.matchday },
      m.events, m.home, m.away,
    );
    const side: Side = m.home.clubId === clubId ? 'HOME' : 'AWAY';
    const ts = side === 'HOME' ? stats.summary.home : stats.summary.away;
    const os = side === 'HOME' ? stats.summary.away : stats.summary.home;

    games++;
    gf += ts.goals; ga += os.goals;
    if (ts.goals > os.goals) wins++; else if (ts.goals === os.goals) draws++; else losses++;
    poss += ts.possessions; turnovers += ts.turnovers; shots += ts.shots; goals += ts.goals;
    gPos += ts.goalsByPhase.positional; pPos += ts.possessionsByPhase.positional;
    gCnt += ts.goalsByPhase.counter; pCnt += ts.possessionsByPhase.counter;

    // Mapa dorsal -> playerId de catálogo para el lado del club.
    const roster = (side === 'HOME' ? m.home : m.away).players;
    const catId = new Map(roster.map((p) => [p.number, p.playerId]));

    for (const pl of stats.players.filter((p) => p.side === side)) {
      const pid = catId.get(pl.number);
      if (!pid) continue;   // solo jugadores enlazados al catálogo entran en las fichas
      const agg = players.get(pid) ?? emptyAgg(pid, pl);
      accPlayer(agg, pl);
      players.set(pid, agg);
    }
  }

  const playerCards: PlayerCard[] = [...players.values()].map(cardOf)
    .sort((x, y) => y.playScoreTotal - x.playScoreTotal);

  const teamPlayScore = playerCards.reduce((s, p) => s + p.playScoreTotal, 0);
  const team: TeamCard = {
    games, wins, draws, losses,
    playScoreTotal: round2(teamPlayScore),
    playScoreAvg: games > 0 ? round2(teamPlayScore / games) : null,
    goalsFor: gf, goalsAgainst: ga,
    goalsForAvg: games > 0 ? round1(gf / games) : null,
    goalsAgainstAvg: games > 0 ? round1(ga / games) : null,
    possessionsAvg: games > 0 ? round1(poss / games) : null,
    turnoverPct: pct(turnovers, poss),
    shootingPct: pct(goals, shots),
    phaseEff: { positional: pct(gPos, pPos), counter: pct(gCnt, pCnt) },
    ranking: playerCards.slice(0, 5).map((p) => ({ playerId: p.playerId, name: p.name, number: p.number, playScoreTotal: p.playScoreTotal })),
  };

  return { clubId, season, games, team, players: playerCards };
}

/** Temporadas en las que el club tiene partidos enlazados (para el selector). */
export function clubSeasons(matches: LoadedMatch[], clubId: string): string[] {
  const set = new Set<string>();
  for (const m of matches) {
    if ((m.home.clubId === clubId || m.away.clubId === clubId) && m.season) set.add(m.season);
  }
  return [...set].sort().reverse();
}

// ── Carrera del jugador (entre clubes/temporadas) ────────────────────────────────
import type { RosterPlayer } from './types';

export interface CareerSeason {
  season: string; clubId: string; clubName: string; card: PlayerCard;
}
export interface PlayerCareer {
  personId: string; name: string;
  totals: PlayerCard;
  bySeason: CareerSeason[];
}

/**
 * Carrera de una persona: agrega TODOS los partidos de todas sus pertenencias (clubes/temporadas)
 * que compartan `personId`. `refs` son las pertenencias de esa persona (de listByPerson).
 */
export function buildPlayerCareer(matches: LoadedMatch[], refs: RosterPlayer[], personId: string): PlayerCareer {
  const mine = refs.filter((r) => r.personId === personId);
  const rosterIds = new Set(mine.map((r) => r.id));
  const name = [...mine].sort((a, b) => b.season.localeCompare(a.season))[0]?.name ?? '';

  let totals: PlayerAgg | null = null;
  const buckets = new Map<string, { season: string; clubId: string; clubName: string; agg: PlayerAgg }>();

  for (const m of matches) {
    if (!m.season) continue;
    const stats = liveStats(
      { matchId: m.matchId, playedAt: m.playedAt ?? '', competition: m.competition, matchday: m.matchday },
      m.events, m.home, m.away,
    );
    for (const side of ['HOME', 'AWAY'] as Side[]) {
      const team = side === 'HOME' ? m.home : m.away;
      const nums = new Set(team.players.filter((p) => p.playerId && rosterIds.has(p.playerId)).map((p) => p.number));
      if (nums.size === 0) continue;
      for (const pl of stats.players.filter((p) => p.side === side && nums.has(p.number))) {
        totals ??= emptyAgg(personId, pl);
        accPlayer(totals, pl);
        const key = `${team.clubId}|${m.season}`;
        let b = buckets.get(key);
        if (!b) { b = { season: m.season, clubId: team.clubId ?? '', clubName: team.name, agg: emptyAgg(pl.playerId, pl) }; buckets.set(key, b); }
        accPlayer(b.agg, pl);
      }
    }
  }

  const bySeason: CareerSeason[] = [...buckets.values()]
    .map((b) => ({ season: b.season, clubId: b.clubId, clubName: b.clubName, card: cardOf(b.agg) }))
    .sort((a, b) => b.season.localeCompare(a.season) || a.clubName.localeCompare(b.clubName));

  return { personId, name, totals: cardOf(totals ?? emptyAgg(personId, EMPTY_LINE)), bySeason };
}

// Línea vacía para el caso sin partidos (evita nulls en la ficha de carrera).
const EMPTY_LINE = { number: 0, name: '', position: '', shots: 0, goals: 0, misses: 0, saves: 0,
  turnovers: 0, steals: 0, xg: 0, plusMinus: 0, minutesPlayed: 0,
  playScore: { total: 0 }, onCourt: emptyOc() } as unknown as PlayerLineLike;
