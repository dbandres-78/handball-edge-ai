import { NextResponse } from 'next/server';
import { getMatchesRepo } from '@/features/matches/repository';
import { getCatalogRepo } from '@/features/catalog/repository';
import { promoteMatchToCatalog } from '@/features/catalog/promote';

export const dynamic = 'force-dynamic';

/**
 * Vuelca las plantillas actuales del partido al catálogo (clubes + jugadores reutilizables) y
 * enlaza el partido (club_id, player_id, temporada). Pensado para el flujo «Rápido» o para
 * plantillas editadas en la sala. Devuelve los equipos ya enlazados para que la sala actualice
 * su estado y el autosave conserve los enlaces.
 */
export async function POST(req: Request, { params }: { params: { matchId: string } }) {
  const body = (await req.json().catch(() => null)) as { season?: string } | null;
  const season = body?.season?.trim() || '26/27';

  try {
    const [matches, catalog] = await Promise.all([getMatchesRepo(), getCatalogRepo()]);
    const linked = await promoteMatchToCatalog(matches, catalog, params.matchId, season);
    return NextResponse.json({ ok: true, season, ...linked });
  } catch (e) {
    const msg = (e as Error).message;
    const status = msg === 'Partido no encontrado' ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
