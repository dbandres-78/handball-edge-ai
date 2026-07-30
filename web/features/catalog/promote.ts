import type { UiTeam, UiPlayer } from '@/lib/handball/mapping';
import type { MatchesRepository } from '@/features/matches/repository';
import type { CatalogRepository } from '@/features/catalog/repository';

/**
 * Promueve las plantillas de un partido al catálogo y enlaza el partido.
 *
 * Pensado para el flujo «Rápido» (empezaste con dorsales genéricos) o para plantillas editadas
 * en la sala: vuelca club + jugadores al catálogo (reutilizables) y escribe los enlaces en el
 * partido (club_id, player_id, temporada). Por lado:
 *   · Club: usa el clubId si ya lo tiene; si no, crea uno con el nombre del equipo.
 *   · Jugadores: los que ya tienen playerId se respetan tal cual (no se pisa el catálogo).
 *     Los que no, se enlazan al roster_player del MISMO dorsal en esa temporada si existe;
 *     si no existe, se da de alta. → idempotente: repetir no duplica.
 * Fija además la temporada del partido.
 */
export async function promoteMatchToCatalog(
  matches: MatchesRepository,
  catalog: CatalogRepository,
  matchId: string,
  season: string,
): Promise<{ home: UiTeam; away: UiTeam }> {
  const match = await matches.get(matchId);
  if (!match) throw new Error('Partido no encontrado');
  await catalog.ensureSeason(season);

  const resolveSide = async (team: UiTeam): Promise<UiTeam> => {
    const clubId = team.clubId ?? (await catalog.createClub({ name: team.name })).id;
    const existing = await catalog.listRoster(clubId, season);
    const byNumber = new Map(existing.map((r) => [r.number, r]));

    const players: UiPlayer[] = [];
    for (const p of team.players) {
      if (p.playerId) { players.push(p); continue; }               // ya enlazado: no se toca
      const reuse = byNumber.get(p.number);
      if (reuse) { players.push({ ...p, playerId: reuse.id }); continue; }   // reutiliza por dorsal
      const rp = await catalog.addPlayer({
        clubId, season, number: p.number, name: p.name, position: p.gk ? 'GK' : undefined,
      });
      byNumber.set(rp.number, rp);
      players.push({ ...p, playerId: rp.id });
    }
    return { ...team, clubId, players };
  };

  const home = await resolveSide(match.home);
  const away = await resolveSide(match.away);

  await matches.saveRoster(matchId, home, away);   // mergeTeamLinks persiste club_id/player_id
  await matches.setSeason(matchId, season);
  return { home, away };
}
