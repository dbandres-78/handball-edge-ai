import { AttackPhase, EventType, MatchEvent, ShotOrigin, ShotOutcome, ShotPayload, SubstitutionPayload, TurnoverPayload } from '../domain/match-event';
import { computePlayScore } from './play-score';
import { computeXg } from './xg';
import { MatchSummary, OnCourtSplits, OriginBreakdown, PlayerLine, TeamSummary } from './read-models';
import { ResolvedRoster, ResolvedTeam } from './ports/repositories';

interface PlayerAcc {
  goals: number; shots: number; misses: number; saves: number;
  turnovers: number; steals: number; blocks: number; fouls: number;
  twoMinutes: number; yellowCards: number; redCards: number;
  plusMinus: number;
  xg: number; xgot: number;
  byOrigin: OriginBreakdown;
  oc: OnCourtSplits;
}

const emptyOnCourt = (): OnCourtSplits => ({
  offPoss: 0, defPoss: 0,
  offPosPoss: 0, offPosGoals: 0, offCntPoss: 0, offCntGoals: 0,
  defPosPoss: 0, defPosGoals: 0, defCntPoss: 0, defCntGoals: 0,
});

/** Suma un tiro a su zona de origen. Sin origen anotado, el tiro no entra en el desglose. */
function addOrigin(bag: OriginBreakdown, origin: ShotOrigin | undefined, outcome: ShotOutcome): void {
  if (!origin) return;
  const c = bag[origin] ?? { shots: 0, goals: 0, onTarget: 0, saved: 0, missed: 0, blocked: 0 };
  c.shots++;
  if (outcome === ShotOutcome.GOAL) { c.goals++; c.onTarget++; }
  else if (outcome === ShotOutcome.SAVED) { c.saved++; c.onTarget++; }
  else if (outcome === ShotOutcome.MISSED) { c.missed++; }
  else if (outcome === ShotOutcome.BLOCKED) { c.blocked++; }
  bag[origin] = c;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const emptyPlayerAcc = (): PlayerAcc => ({
  goals: 0, shots: 0, misses: 0, saves: 0,
  turnovers: 0, steals: 0, blocks: 0, fouls: 0,
  twoMinutes: 0, yellowCards: 0, redCards: 0,
  plusMinus: 0,
  xg: 0, xgot: 0,
  byOrigin: {},
  oc: emptyOnCourt(),
});

/**
 * Función PURA: (eventos canónicos + roster) -> read-models.
 * No depende de la fuente ni de NormalizedMatch, así que puede reejecutarse en cualquier
 * momento desde los eventos ya persistidos. Esta es la base de "todo se recalcula desde eventos".
 */
export function recomputeAggregates(
  match: { matchId: string; playedAt: string; competition?: string; matchday?: number },
  events: MatchEvent[],
  roster: ResolvedRoster,
): { summary: MatchSummary; players: PlayerLine[] } {
  const playerAcc = new Map<string, PlayerAcc>();
  for (const p of roster.players) playerAcc.set(p.playerId, emptyPlayerAcc());
  const teamOfPlayer = new Map<string, string>(roster.players.map(p => [p.playerId, p.teamId]));

  const teamGoals = new Map<string, number>();
  const teamSaves = new Map<string, number>();
  const teamTurnovers = new Map<string, number>();
  const teamSteals = new Map<string, number>();
  const teamBlocks = new Map<string, number>();
  const teamNearPasses = new Map<string, number>();
  const teamTwoMin = new Map<string, number>();
  const teamYellow = new Map<string, number>();
  const teamRed = new Map<string, number>();
  const teamTimeouts = new Map<string, number>();
  const teamShots = new Map<string, number>();
  const teamXg = new Map<string, number>();
  const teamXgot = new Map<string, number>();
  const teamOrigins = new Map<string, OriginBreakdown>();
  const teamGoalZones = new Map<string, Partial<Record<number, number>>>();
  // Posesiones y desglose por fase.
  const teamPoss = new Map<string, number>();
  const teamPossPos = new Map<string, number>();
  const teamPossCounter = new Map<string, number>();
  const teamGoalsPos = new Map<string, number>();
  const teamGoalsCounter = new Map<string, number>();
  for (const t of roster.teams) { teamOrigins.set(t.teamId, {}); teamGoalZones.set(t.teamId, {}); }
  for (const t of roster.teams) {
    for (const m of [teamGoals, teamSaves, teamTurnovers, teamSteals, teamBlocks, teamNearPasses, teamTwoMin, teamYellow, teamRed, teamTimeouts, teamShots, teamXg, teamXgot, teamPoss, teamPossPos, teamPossCounter, teamGoalsPos, teamGoalsCounter]) {
      m.set(t.teamId, 0);
    }
  }
  const inc = (m: Map<string, number>, k: string, by = 1) => m.set(k, (m.get(k) ?? 0) + by);

  // ── Reconstrucción de "quién está en pista" para el ± (plus-minus) ───────────────
  // Se parte de los titulares y se va mutando con cada SUBSTITUTION y GOALKEEPER_CHANGE.
  // Si no hay cambios registrados, los titulares se consideran en pista todo el partido
  // (degradación honesta; el ± del banquillo queda a 0 hasta que se etiqueten cambios).
  const onCourt = new Map<string, Set<string>>();       // teamId -> jugadores en pista
  const currentGk = new Map<string, string | undefined>();
  const opponentTeamId = new Map<string, string>();
  for (const t of roster.teams) {
    onCourt.set(t.teamId, new Set());
    currentGk.set(t.teamId, undefined);
    const opp = roster.teams.find(x => x.teamId !== t.teamId);
    if (opp) opponentTeamId.set(t.teamId, opp.teamId);
  }
  for (const p of roster.players) {
    if (!p.starter) continue;
    onCourt.get(p.teamId)?.add(p.playerId);
    if (p.position === 'GK' && !currentGk.get(p.teamId)) currentGk.set(p.teamId, p.playerId);
  }

  // ── Posesiones (por cambio real de balón) y fase ────────────────────────────────
  // Una posesión de un equipo termina cuando pierde el balón: tira (SHOT), lo pierde
  // (TURNOVER) o se lo roban (STEAL del rival). Se sigue quién tiene el balón (`holder`)
  // para no doblar el conteo cuando pérdida y robo del mismo balón se anotan por separado.
  // La fase solo la llevan las acciones ofensivas terminales (tiro/pérdida); las posesiones
  // cerradas por robo entran en el total pero no en el desglose por fase.
  let holder: string | undefined;
  let pendingStealLoser: string | undefined;   // equipo cuya posesión acaba de cerrar un robo (evita doblar con su pérdida)
  const endPossession = (teamId: string, phase: AttackPhase | undefined, scored: boolean) => {
    inc(teamPoss, teamId);
    if (phase === AttackPhase.POSITIONAL) { inc(teamPossPos, teamId); if (scored) inc(teamGoalsPos, teamId); }
    else if (phase === AttackPhase.COUNTER) { inc(teamPossCounter, teamId); if (scored) inc(teamGoalsCounter, teamId); }

    // On-court: atribuye la posesión (y el gol) a los jugadores en pista de ambos equipos.
    const oppId = opponentTeamId.get(teamId);
    for (const pid of onCourt.get(teamId) ?? []) {
      const a = playerAcc.get(pid); if (!a) continue;
      a.oc.offPoss++;
      if (phase === AttackPhase.POSITIONAL) { a.oc.offPosPoss++; if (scored) a.oc.offPosGoals++; }
      else if (phase === AttackPhase.COUNTER) { a.oc.offCntPoss++; if (scored) a.oc.offCntGoals++; }
    }
    if (oppId) for (const pid of onCourt.get(oppId) ?? []) {
      const a = playerAcc.get(pid); if (!a) continue;
      a.oc.defPoss++;
      if (phase === AttackPhase.POSITIONAL) { a.oc.defPosPoss++; if (scored) a.oc.defPosGoals++; }
      else if (phase === AttackPhase.COUNTER) { a.oc.defCntPoss++; if (scored) a.oc.defCntGoals++; }
    }
  };

  for (const ev of events) {
    const acc = ev.playerId ? playerAcc.get(ev.playerId) : undefined;
    switch (ev.type) {
      case EventType.SUBSTITUTION: {
        const sub = ev.payload as unknown as SubstitutionPayload;
        const set = onCourt.get(ev.teamId);
        if (set) {
          if (sub.playerOutId) set.delete(sub.playerOutId);
          if (sub.playerInId) set.add(sub.playerInId);
        }
        break;
      }
      case EventType.GOALKEEPER_CHANGE: {
        // El portero entrante sustituye al que estaba en pista (cambio portero-por-portero).
        if (ev.playerId) {
          const set = onCourt.get(ev.teamId);
          const prev = currentGk.get(ev.teamId);
          if (set) {
            if (prev && prev !== ev.playerId) set.delete(prev);
            set.add(ev.playerId);
          }
          currentGk.set(ev.teamId, ev.playerId);
        }
        break;
      }
      case EventType.SHOT: {
        const shot = ev.payload as unknown as ShotPayload;
        inc(teamShots, ev.teamId);
        if (acc) acc.shots++;
        addOrigin(teamOrigins.get(ev.teamId)!, shot.origin, shot.outcome);
        if (acc) addOrigin(acc.byOrigin, shot.origin, shot.outcome);

        // xG / xGOT: onTarget = tiro que va a puerta (gol o parada).
        const onTarget = shot.outcome === ShotOutcome.GOAL || shot.outcome === ShotOutcome.SAVED;
        const { xg, xgot } = computeXg({
          origin: shot.origin, zone: shot.zone, isPenalty: shot.isPenalty, onTarget,
        });
        inc(teamXg, ev.teamId, xg);
        if (xgot != null) inc(teamXgot, ev.teamId, xgot);
        if (acc) {
          acc.xg += xg;
          if (xgot != null) acc.xgot += xgot;
        }
        if (shot.outcome === ShotOutcome.GOAL) {
          if (acc) acc.goals++;
          inc(teamGoals, ev.teamId);
          if (shot.zone) {
            const gz = teamGoalZones.get(ev.teamId)!;
            gz[shot.zone] = (gz[shot.zone] ?? 0) + 1;
          }
          // ±: +1 a los en pista del equipo que marca, −1 a los del rival.
          for (const pid of onCourt.get(ev.teamId) ?? []) {
            const a = playerAcc.get(pid); if (a) a.plusMinus += 1;
          }
          const oppId = opponentTeamId.get(ev.teamId);
          if (oppId) for (const pid of onCourt.get(oppId) ?? []) {
            const a = playerAcc.get(pid); if (a) a.plusMinus -= 1;
          }
        } else if (acc) {
          acc.misses++;
        }
        if (shot.outcome === ShotOutcome.SAVED && shot.goalkeeperId) {
          const gk = playerAcc.get(shot.goalkeeperId);
          if (gk) gk.saves++;
          const gkTeam = teamOfPlayer.get(shot.goalkeeperId);
          if (gkTeam) inc(teamSaves, gkTeam);
        }
        if (shot.outcome === ShotOutcome.BLOCKED && shot.blockerId) {
          const blocker = playerAcc.get(shot.blockerId);
          if (blocker) blocker.blocks++;
          const blockerTeam = teamOfPlayer.get(shot.blockerId);
          if (blockerTeam) inc(teamBlocks, blockerTeam);
        }
        // Un tiro cierra siempre la posesión del que lanza (incluido el 7 m, que lleva fase).
        endPossession(ev.teamId, shot.phase, shot.outcome === ShotOutcome.GOAL);
        holder = opponentTeamId.get(ev.teamId);
        pendingStealLoser = undefined;
        break;
      }
      case EventType.TURNOVER: {
        if (acc) acc.turnovers++;
        inc(teamTurnovers, ev.teamId);
        const to = ev.payload as unknown as TurnoverPayload;
        // La pérdida cierra posesión, salvo que un robo del rival ya la hubiera cerrado (mismo balón).
        if (pendingStealLoser === ev.teamId) { pendingStealLoser = undefined; }
        else { endPossession(ev.teamId, to.phase, false); }
        holder = opponentTeamId.get(ev.teamId);
        break;
      }
      case EventType.STEAL: {
        if (acc) acc.steals++;
        inc(teamSteals, ev.teamId);
        // El robo cierra la posesión del RIVAL, salvo que el balón ya fuera de este equipo
        // (p.ej. una pérdida del rival ya contada): así no se dobla el conteo.
        if (holder !== ev.teamId) {
          const opp = opponentTeamId.get(ev.teamId);
          if (opp) { endPossession(opp, undefined, false); pendingStealLoser = opp; }
        } else {
          pendingStealLoser = undefined;
        }
        holder = ev.teamId;
        break;
      }
      case EventType.NEAR_PASS: inc(teamNearPasses, ev.teamId); break;   // evento de equipo, sin jugador
      case EventType.FOUL:     if (acc) acc.fouls++; break;
      case EventType.TWO_MINUTES: if (acc) acc.twoMinutes++; inc(teamTwoMin, ev.teamId); break;
      case EventType.YELLOW_CARD: if (acc) acc.yellowCards++; inc(teamYellow, ev.teamId); break;
      case EventType.RED_CARD:    if (acc) acc.redCards++;    inc(teamRed, ev.teamId); break;
      case EventType.TIMEOUT:  inc(teamTimeouts, ev.teamId); break;
    }
  }

  const opponentOf = (teamId: string): ResolvedTeam | undefined =>
    roster.teams.find(t => t.teamId !== teamId);

  const buildTeamSummary = (t: ResolvedTeam): TeamSummary => {
    const saves = teamSaves.get(t.teamId) ?? 0;
    const opp = opponentOf(t.teamId);
    const goalsConceded = opp ? (teamGoals.get(opp.teamId) ?? 0) : 0;
    const facedShots = saves + goalsConceded;
    return {
      teamId: t.teamId, side: t.side, name: t.name,
      goals: teamGoals.get(t.teamId) ?? 0,
      shots: teamShots.get(t.teamId) ?? 0,
      saves,
      savePct: facedShots > 0 ? Math.round((saves / facedShots) * 10000) / 10000 : null,
      xg: round2(teamXg.get(t.teamId) ?? 0),
      xgot: round2(teamXgot.get(t.teamId) ?? 0),
      byOrigin: teamOrigins.get(t.teamId) ?? {},
      goalZones: teamGoalZones.get(t.teamId) ?? {},
      turnovers: teamTurnovers.get(t.teamId) ?? 0,
      steals: teamSteals.get(t.teamId) ?? 0,
      blocks: teamBlocks.get(t.teamId) ?? 0,
      nearPasses: teamNearPasses.get(t.teamId) ?? 0,
      possessions: teamPoss.get(t.teamId) ?? 0,
      possessionsByPhase: {
        positional: teamPossPos.get(t.teamId) ?? 0,
        counter: teamPossCounter.get(t.teamId) ?? 0,
      },
      goalsByPhase: {
        positional: teamGoalsPos.get(t.teamId) ?? 0,
        counter: teamGoalsCounter.get(t.teamId) ?? 0,
      },
      twoMinutes: teamTwoMin.get(t.teamId) ?? 0,
      yellowCards: teamYellow.get(t.teamId) ?? 0,
      redCards: teamRed.get(t.teamId) ?? 0,
      timeouts: teamTimeouts.get(t.teamId) ?? 0,
    };
  };

  const home = roster.teams.find(t => t.side === 'HOME')!;
  const away = roster.teams.find(t => t.side === 'AWAY')!;

  const summary: MatchSummary = {
    matchId: match.matchId,
    playedAt: match.playedAt,
    competition: match.competition,
    matchday: match.matchday,
    home: buildTeamSummary(home),
    away: buildTeamSummary(away),
  };

  const players: PlayerLine[] = roster.players.map(p => {
    const a = playerAcc.get(p.playerId) ?? emptyPlayerAcc();
    return {
      matchId: match.matchId,
      playerId: p.playerId,
      teamId: p.teamId,
      side: p.side,
      number: p.number,
      name: p.name,
      position: p.position,
      goals: a.goals, shots: a.shots, misses: a.misses, saves: a.saves,
      xg: round2(a.xg), xgot: round2(a.xgot), byOrigin: a.byOrigin,
      turnovers: a.turnovers, steals: a.steals, blocks: a.blocks, fouls: a.fouls,
      twoMinutes: a.twoMinutes, yellowCards: a.yellowCards, redCards: a.redCards,
      plusMinus: a.plusMinus,
      onCourt: a.oc,
      playScore: computePlayScore({
        goals: a.goals, misses: a.misses, turnovers: a.turnovers, saves: a.saves,
        steals: a.steals, blocks: a.blocks, fouls: a.fouls,
        twoMinutes: a.twoMinutes, redCards: a.redCards, plusMinus: a.plusMinus,
      }),
    };
  });

  return { summary, players };
}
