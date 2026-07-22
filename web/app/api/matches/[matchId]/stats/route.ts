import { NextResponse } from 'next/server';
import { getMatchesRepo } from '@/features/matches/repository';
import { liveStats } from '@/lib/handball/mapping';

export const dynamic = 'force-dynamic';

/**
 * Extracción de estadística por partido.
 * Aquí se recalculan los read-models canónicos desde los eventos y se marca el partido
 * como "extraído". En producción esto delega en el IngestMatchUseCase de la API Nest
 * (misma capa de eventos, misma función de recompute que ya usa esta ruta).
 */
export async function POST(_req: Request, { params }: { params: { matchId: string } }) {
  const match = await (await getMatchesRepo()).get(params.matchId);
  if (!match) return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 });

  const stats = liveStats(
    { matchId: match.matchId, competition: match.competition, matchday: match.matchday, playedAt: match.playedAt },
    match.events, match.home, match.away,
  );
  await (await getMatchesRepo()).markExtracted(match.matchId);

  return NextResponse.json({
    ok: true,
    matchId: match.matchId,
    homeGoals: stats.summary.home.goals,
    awayGoals: stats.summary.away.goals,
    summary: stats.summary,
  });
}

export async function GET(_req: Request, { params }: { params: { matchId: string } }) {
  const match = await (await getMatchesRepo()).get(params.matchId);
  if (!match) return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 });
  const stats = liveStats(
    { matchId: match.matchId, competition: match.competition, matchday: match.matchday, playedAt: match.playedAt },
    match.events, match.home, match.away,
  );
  return NextResponse.json(stats);
}
