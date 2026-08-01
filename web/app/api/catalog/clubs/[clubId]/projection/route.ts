import { NextResponse } from 'next/server';
import { getMatchesRepo } from '@/features/matches/repository';
import { getCatalogRepo } from '@/features/catalog/repository';
import { buildClubProjection, clubSeasons } from '@/features/catalog/projection';
import type { LoadedMatch } from '@/features/matches/types';

export const dynamic = 'force-dynamic';

/**
 * Fichas de un club por temporada (proyección on-demand). Recorre todos los partidos, se queda con
 * los enlazados a este club, y agrega la temporada pedida (o la más reciente). Devuelve también las
 * temporadas disponibles para el selector.
 */
export async function GET(req: Request, { params }: { params: { clubId: string } }) {
  const seasonQ = new URL(req.url).searchParams.get('season') ?? undefined;
  const [matchesRepo, catalog] = await Promise.all([getMatchesRepo(), getCatalogRepo()]);

  const club = await catalog.getClub(params.clubId);
  if (!club) return NextResponse.json({ error: 'Club no encontrado' }, { status: 404 });

  const items = await matchesRepo.list();
  const loaded = (await Promise.all(items.map((i) => matchesRepo.get(i.matchId)))).filter(Boolean) as LoadedMatch[];

  const seasons = clubSeasons(loaded, params.clubId);
  const season = seasonQ && seasons.includes(seasonQ) ? seasonQ : seasons[0];
  const projection = season ? buildClubProjection(loaded, params.clubId, season) : null;

  // Enriquece con person_id y descarta jugadores borrados del catálogo (ya no deben aparecer en la
  // ficha, aunque sus eventos sigan en los partidos y cuenten para la estadística de equipo).
  if (projection) {
    const resolved = await Promise.all(projection.players.map(async (p) => {
      const rp = await catalog.getPlayer(p.playerId);
      if (rp) p.personId = rp.personId;
      return { p, exists: !!rp };
    }));
    projection.players = resolved.filter((r) => r.exists).map((r) => r.p);
    const validIds = new Set(projection.players.map((p) => p.playerId));
    projection.team.ranking = projection.team.ranking.filter((r) => validIds.has(r.playerId));
  }

  return NextResponse.json({ club, seasons, season, projection });
}
